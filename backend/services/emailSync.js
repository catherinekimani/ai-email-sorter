const User = require("../models/User");
const Account = require("../models/Account");
const Category = require("../models/Category");
const Email = require("../models/Email");
const gmailService = require("./gmail");
const aiService = require("./ai");

class EmailSyncService {
  constructor() {
    this.isRunning = false;
  }

  async syncUserEmails(userId, accountId = null) {
    try {
      const categories = await Category.find({ userId });
      if (categories.length === 0) {
        return { synced: 0, message: "No categories found" };
      }

      let accountsToSync;
      if (accountId) {
        const account = await Account.findOne({ _id: accountId, userId });
        if (!account) {
          throw new Error("Account not found");
        }
        accountsToSync = [account];
      } else {
        accountsToSync = await Account.find({ userId });
      }

      if (accountsToSync.length === 0) {
        return { synced: 0, message: "No Gmail accounts connected" };
      }

      let totalSyncedCount = 0;
      let totalEmailsProcessed = 0;

      for (const account of accountsToSync) {
        try {
          const newEmails = await gmailService.getNewEmails(account, 20);

          let syncedCount = 0;

          for (const emailData of newEmails) {
            try {
              const existingEmail = await Email.findOne({
                gmailId: emailData.id,
                userId: userId,
                accountId: account._id,
              });

              if (existingEmail) {
                continue;
              }

              const category = await aiService.categorizeEmail(
                emailData,
                categories
              );

              let summary = "Processing summary...";
              let unsubscribeLink = null;

              try {
                summary = await aiService.summarizeEmail(emailData);
              } catch (summaryError) {
                summary = "Summary unavailable due to processing error";
              }

              try {
                unsubscribeLink = aiService.extractUnsubscribeLink(
                  emailData.body
                );
              } catch (linkError) {}

              const email = new Email({
                userId: userId,
                accountId: account._id,
                categoryId: category._id,
                gmailId: emailData.id,
                from: emailData.from,
                subject: emailData.subject,
                body: emailData.body,
                aiSummary: summary,
                unsubscribeLink: unsubscribeLink,
                receivedDate: emailData.date
                  ? new Date(emailData.date)
                  : new Date(),
              });

              await email.save();

              try {
                await gmailService.markEmailAsProcessed(account, emailData.id);
              } catch (markError) {}

              await Category.findByIdAndUpdate(category._id, {
                $inc: { emailCount: 1 },
              });

              syncedCount++;
            } catch (emailError) {}
          }

          totalSyncedCount += syncedCount;
          totalEmailsProcessed += newEmails.length;
        } catch (accountError) {}
      }

      return {
        synced: totalSyncedCount,
        total: totalEmailsProcessed,
        message: `Synced ${totalSyncedCount} out of ${totalEmailsProcessed} new emails across ${accountsToSync.length} account(s)`,
      };
    } catch (error) {
      throw error;
    }
  }

  async syncAllUsers() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const accounts = await Account.find({
        accessToken: { $exists: true },
        refreshToken: { $exists: true },
      }).populate("userId", "email");

      const userAccountsMap = {};
      accounts.forEach((account) => {
        const userId = account.userId._id.toString();
        if (!userAccountsMap[userId]) {
          userAccountsMap[userId] = {
            user: account.userId,
            accounts: [],
          };
        }
        userAccountsMap[userId].accounts.push(account);
      });

      const results = [];

      for (const [userId, userData] of Object.entries(userAccountsMap)) {
        try {
          const result = await this.syncUserEmails(userId);
          results.push({
            userId: userId,
            email: userData.user.email,
            accountCount: userData.accounts.length,
            ...result,
          });
        } catch (userError) {
          results.push({
            userId: userId,
            email: userData.user.email,
            synced: 0,
            error: userError.message,
          });
        }
      }

      return results;
    } catch (error) {
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async archiveEmails(userId, emailIds) {
    try {
      const results = [];

      for (const emailId of emailIds) {
        try {
          const email = await Email.findOne({
            _id: emailId,
            userId: userId,
          });

          if (!email) {
            results.push({ emailId, success: false, error: "Email not found" });
            continue;
          }

          await Email.findByIdAndUpdate(emailId, { isArchived: true });
          results.push({ emailId, success: true });
        } catch (error) {
          results.push({ emailId, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  startAutoSync() {
    setTimeout(() => {
      this.syncAllUsers();
    }, 30000);

    setInterval(() => {
      this.syncAllUsers();
    }, 15 * 60 * 1000);
  }
}

module.exports = new EmailSyncService();
