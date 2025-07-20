const express = require("express");
const Email = require("../models/Email");
const Category = require("../models/Category");
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
    }).sort({ createdAt: -1 });

    res.json(emails);
  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/sync", auth, async (req, res) => {
  try {

    const categories = await Category.find({ userId: req.user._id });
    if (categories.length === 0) {
      return res.status(400).json({ msg: "No categories found" });
    }

    let newEmails = [];
    try {
      newEmails = await gmailService.getNewEmails(req.user);
    } catch (gmailError) {
      return res.status(500).json({
        msg: "Failed to fetch emails from Gmail",
        error: gmailError.message,
      });
    }

    if (newEmails.length === 0) {
      return res.json({ msg: "No new emails to sync" });
    }

    let syncedCount = 0;
    let errors = [];

    for (const emailData of newEmails) {
      try {
        const existingEmail = await Email.findOne({
          gmailId: emailData.id,
          userId: req.user._id,
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
          categoryId: category._id,
          gmailId: emailData.id,
          from: emailData.from || "Unknown sender",
          subject: emailData.subject || "No subject",
          body: emailData.body || "",
          aiSummary: summary,
          unsubscribeLink: unsubscribeLink,
          receivedDate: emailData.date ? new Date(emailData.date) : new Date(),
        });

        await email.save();

        try {
        } catch (archiveError) {
        }

        await Category.findByIdAndUpdate(category._id, {
          $inc: { emailCount: 1 },
        });

        syncedCount++;
      } catch (emailError) {
      }
    }

    const message = `Synced ${syncedCount} out of ${newEmails.length} emails`;

    if (errors.length > 0) {
    }

    res.json({
      msg: message,
      synced: syncedCount,
      total: newEmails.length,
      errors: errors.length,
    });
  } catch (error) {
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
        const success = await unsubscribeService.unsubscribe(
          email.unsubscribeLink
        );
        results.push({ emailId: email._id, success });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ msg: "Unsubscribe failed" });
  }
});

router.delete("/bulk", auth, async (req, res) => {
  try {
    const { emailIds } = req.body;
    await Email.deleteMany({ _id: { $in: emailIds }, userId: req.user._id });
    res.json({ msg: "Emails deleted" });
  } catch (error) {
    res.status(500).json({ msg: "Delete failed" });
  }
});

module.exports = router;
