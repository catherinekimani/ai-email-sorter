const { google } = require("googleapis");

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async getGmailClient(user) {
    this.oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
    });

    return google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  async getNewEmails(user, maxResults = 10) {
    try {
      const gmail = await this.getGmailClient(user);

      const response = await gmail.users.messages.list({
        userId: "me",
        q: "in:inbox is:unread -label:ai-email-sorter-processed",
        maxResults,
      });

      if (!response.data.messages) {
        return [];
      }

      const emails = [];
      for (const message of response.data.messages) {
        const email = await this.getEmailDetails(gmail, message.id);
        emails.push(email);
      }

      return emails;
    } catch (error) {
      if (error.code === 401) {
        try {
          await this.refreshAccessToken(user);
          return this.getNewEmails(user, maxResults);
        } catch (refreshError) {
          throw refreshError;
        }
      }
      throw error;
    }
  }

  async getEmailDetails(gmail, messageId) {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload.headers;

    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    let body = "";
    if (message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, "base64").toString();
    } else if (message.payload.parts) {
      const textPart = message.payload.parts.find(
        (part) => part.mimeType === "text/plain"
      );
      const htmlPart = message.payload.parts.find(
        (part) => part.mimeType === "text/html"
      );

      const partToUse = textPart || htmlPart;
      if (partToUse && partToUse.body.data) {
        body = Buffer.from(partToUse.body.data, "base64").toString();
      }
    }

    return {
      id: messageId,
      subject,
      from,
      date,
      body: body.substring(0, 10000),
    };
  }

  async markEmailAsProcessed(user, messageId) {
    try {
      const gmail = await this.getGmailClient(user);

      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: ["UNREAD"],
        },
      });

      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async archiveEmail(user, messageId) {
    try {
      const gmail = await this.getGmailClient(user);

      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: ["INBOX"],
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async refreshAccessToken(user) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: user.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      const User = require("../models/User");
      await User.findByIdAndUpdate(user._id, {
        accessToken: credentials.access_token,
      });

      user.accessToken = credentials.access_token;

      return credentials.access_token;
    } catch (error) {
      throw error;
    }
  }

  async getUserProfile(user) {
    try {
      const gmail = await this.getGmailClient(user);
      const response = await gmail.users.getProfile({
        userId: "me",
      });

      return {
        email: response.data.emailAddress,
        messagesTotal: response.data.messagesTotal,
        threadsTotal: response.data.threadsTotal,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new GmailService();
