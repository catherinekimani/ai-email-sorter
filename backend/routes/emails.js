const express = require("express");
const Email = require("../models/Email");
const Category = require("../models/Category");
const Account = require("../models/Account");
const auth = require("../middleware/auth");
const gmailService = require("../services/gmail");
const aiService = require("../services/ai");
const unsubscribeService = require("../services/unsubscribe");

const router = express.Router();

router.get("/category/:categoryId", auth, async (req, res) => {
  try {
    const emails = await Email.find({
      userId: req.user._id,
      categoryId: req.params.categoryId,
    })
      .populate("accountId", "email")
      .sort({ createdAt: -1 });

    res.json(emails);
  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/sync", auth, async (req, res) => {
  try {
    console.log("=== EMAIL SYNC REQUEST ===");

    const { accountId } = req.body;

    const categories = await Category.find({ userId: req.user._id });
    if (categories.length === 0) {
      return res.status(400).json({
        msg: "Please create at least one category before syncing emails",
      });
    }

    let accountsToSync;
    if (accountId) {
      const account = await Account.findOne({
        _id: accountId,
        userId: req.user._id,
      });
      if (!account) {
        return res.status(404).json({ msg: "Gmail account not found" });
      }
      accountsToSync = [account];
    } else {
      accountsToSync = await Account.find({ userId: req.user._id });
    }

    if (accountsToSync.length === 0) {
      return res.status(400).json({
        msg: "No Gmail accounts connected. Please connect a Gmail account first.",
      });
    }

    let totalSyncedCount = 0;
    let totalEmailsProcessed = 0;
    let errors = [];

    for (const account of accountsToSync) {
      try {

        let newEmails = [];
        try {
          newEmails = await gmailService.getNewEmails(account, 20);
        } catch (gmailError) {

          if (
            gmailError.message.includes("auth") ||
            gmailError.message.includes("token")
          ) {
            errors.push({
              account: account.email,
              error:
                "Authentication expired. Please reconnect this Gmail account.",
            });
            continue;
          }

          errors.push({
            account: account.email,
            error: `Failed to fetch emails: ${gmailError.message}`,
          });
          continue;
        }

        if (newEmails.length === 0) {
          continue;
        }

        let accountSyncedCount = 0;

        for (const emailData of newEmails) {
          try {
            const existingEmail = await Email.findOne({
              gmailId: emailData.id,
              userId: req.user._id,
              accountId: account._id,
            });

            if (existingEmail) {
              continue;
            }

            let category;
            try {
              category = await aiService.categorizeEmail(emailData, categories);
            } catch (aiError) {
              category = categories[0];
            }

            let summary = "Summary not available";
            try {
              summary = await aiService.summarizeEmail(emailData);
            } catch (summaryError) {
            }

            let unsubscribeLink = null;
            try {
              unsubscribeLink = aiService.extractUnsubscribeLink(
                emailData.body || ""
              );
            } catch (linkError) {
            }

            const email = new Email({
              userId: req.user._id,
              accountId: account._id,
              categoryId: category._id,
              gmailId: emailData.id,
              from: emailData.from || "Unknown sender",
              subject: emailData.subject || "No subject",
              body: emailData.body || "",
              aiSummary: summary,
              unsubscribeLink: unsubscribeLink,
              receivedDate: emailData.date
                ? new Date(emailData.date)
                : new Date(),
            });

            await email.save();

            await Category.findByIdAndUpdate(category._id, {
              $inc: { emailCount: 1 },
            });

            accountSyncedCount++;
          } catch (emailError) {
            errors.push({
              account: account.email,
              emailId: emailData.id,
              error: emailError.message,
            });
          }
        }

        totalSyncedCount += accountSyncedCount;
        totalEmailsProcessed += newEmails.length;

      } catch (accountError) {
        errors.push({
          account: account.email,
          error: accountError.message,
        });
      }
    }

    let message;
    if (totalSyncedCount === 0 && totalEmailsProcessed === 0) {
      message = "No new emails to sync";
    } else {
      message = `Synced ${totalSyncedCount} out of ${totalEmailsProcessed} emails across ${accountsToSync.length} account(s)`;
    }

    const response = {
      msg: message,
      synced: totalSyncedCount,
      total: totalEmailsProcessed,
      accounts: accountsToSync.length,
      errors: errors.length,
    };

    if (errors.length > 0) {
      response.errorDetails = errors;
    }

    const authErrors = errors.filter(
      (e) => e.error.includes("auth") || e.error.includes("token")
    );
    if (authErrors.length > 0) {
      response.authenticationRequired = true;
      response.msg = `${message}. Some accounts need re-authentication.`;
    }

    res.json(response);
  } catch (error) {
    console.error("=== EMAIL SYNC ERROR ===");

    res.status(500).json({
      msg: "Sync failed",
      error: error.message,
    });
  }
});

router.post("/unsubscribe", auth, async (req, res) => {
  try {
    const { emailIds } = req.body;
    const emails = await Email.find({
      _id: { $in: emailIds },
      userId: req.user._id,
    });

    const results = [];
    for (const email of emails) {
      if (email.unsubscribeLink) {
        try {
          const success = await unsubscribeService.unsubscribe(
            email.unsubscribeLink
          );
          results.push({ emailId: email._id, success });
        } catch (unsubError) {
          results.push({
            emailId: email._id,
            success: false,
            error: unsubError.message,
          });
        }
      } else {
        results.push({
          emailId: email._id,
          success: false,
          error: "No unsubscribe link found",
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ msg: "Unsubscribe failed", error: error.message });
  }
});

router.delete("/bulk", auth, async (req, res) => {
  try {
    const { emailIds } = req.body;
    const result = await Email.deleteMany({
      _id: { $in: emailIds },
      userId: req.user._id,
    });

    res.json({
      msg: `${result.deletedCount} emails deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ msg: "Delete failed", error: error.message });
  }
});

router.get("/account/:accountId", auth, async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findOne({
      _id: accountId,
      userId: req.user._id,
    });
    if (!account) {
      return res.status(404).json({ msg: "Account not found" });
    }

    const emails = await Email.find({
      userId: req.user._id,
      accountId: accountId,
    })
      .populate("categoryId", "name color")
      .sort({ receivedDate: -1 });

    res.json({
      account: account.email,
      emails: emails,
    });
  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
