const User = require("../models/User");
const Category = require("../models/Category");
const Email = require("../models/Email");
const gmailService = require("./gmail");
const aiService = require("./ai");

class EmailSyncService {
  constructor() {
    this.isRunning = false;
  }

  async syncUserEmails(user) {
    try {
      const categories = await Category.find({ userId: user._id });
      if (categories.length === 0) {
        return { synced: 0, message: "No categories found" };
      }

      const newEmails = await gmailService.getNewEmails(user, 20);

      let syncedCount = 0;

      for (const emailData of newEmails) {
        try {
          const existingEmail = await Email.findOne({
            gmailId: emailData.id,
            userId: user._id,
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
            unsubscribeLink = aiService.extractUnsubscribeLink(emailData.body);
          } catch (linkError) {}

          const email = new Email({
            userId: user._id,
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

          await gmailService.markEmailAsProcessed(user, emailData.id);

          await Category.findByIdAndUpdate(category._id, {
            $inc: { emailCount: 1 },
          });

          syncedCount++;
        } catch (emailError) {}
      }

      return {
        synced: syncedCount,
        total: newEmails.length,
        message: `Synced ${syncedCount} out of ${newEmails.length} new emails`,
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
      const users = await User.find({
        accessToken: { $exists: true },
        refreshToken: { $exists: true },
      });

      const results = [];
      for (const user of users) {
        try {
          const result = await this.syncUserEmails(user);
          results.push({
            userId: user._id,
            email: user.email,
            ...result,
          });
        } catch (userError) {
          results.push({
            userId: user._id,
            email: user.email,
            synced: 0,
            error: userError.message,
          });
        }
      }

      return results;
    } catch (error) {
    } finally {
      this.isRunning = false;
    }
  }

  async archiveEmails(user, emailIds) {
    try {
      const results = [];

      for (const emailId of emailIds) {
        try {
          const email = await Email.findOne({
            _id: emailId,
            userId: user._id,
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
