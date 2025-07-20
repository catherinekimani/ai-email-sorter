const OpenAI = require("openai");
const cheerio = require("cheerio");
require("dotenv").config();

class AIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      this.openai = null;
    } else {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  async categorizeEmail(emailData, categories) {
    if (!this.openai) {
      return categories[0];
    }

    const categoryDescriptions = categories
      .map((cat) => `${cat.name}: ${cat.description}`)
      .join("\n");

    const prompt = `
Given this email and the available categories, determine which category best fits this email.

Email Subject: ${emailData.subject}
Email From: ${emailData.from}
Email Body: ${emailData.body.substring(0, 1000)}

Available Categories:
${categoryDescriptions}

Respond with only the exact category name that best matches this email.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.3,
      });

      const categoryName = response.choices[0].message.content.trim();

      const matchedCategory = categories.find(
        (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
      );

      if (matchedCategory) {
        return matchedCategory;
      } else {
        return categories[0];
      }
    } catch (error) {
      return categories[0];
    }
  }

  async summarizeEmail(emailData) {
    if (!this.openai) {
      return "AI service unavailable - check OpenAI API key";
    }

    let cleanBody = emailData.body;
    if (cleanBody.includes("<")) {
      try {
        const $ = cheerio.load(cleanBody);
        cleanBody = $.text();
      } catch (e) {}
    }

    const prompt = `
Summarize this email in 1-2 concise sentences focusing on the key action items or main points.

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${cleanBody.substring(0, 2000)}

Summary:
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.5,
      });

      const summary = response.choices[0].message.content.trim();

      return summary;
    } catch (error) {
      if (error.code === "insufficient_quota") {
        return "Summary unavailable - OpenAI quota exceeded";
      } else if (error.code === "invalid_api_key") {
        return "Summary unavailable - Invalid OpenAI API key";
      } else if (error.status === 429) {
        return "Summary unavailable - Rate limit exceeded, try again later";
      } else {
        return "Summary unavailable - AI processing error";
      }
    }
  }

  extractUnsubscribeLink(emailBody) {
    if (!emailBody) return null;

    try {
      let $ = null;

      if (emailBody.includes("<")) {
        try {
          $ = cheerio.load(emailBody);
        } catch (e) {}
      }

      if ($) {
        const unsubscribeSelectors = [
          'a[href*="unsubscribe" i]',
          'a[href*="opt-out" i]',
          'a[href*="remove" i]',
          'a[href*="preferences" i]',
          'a:contains("unsubscribe")',
          'a:contains("opt out")',
          'a:contains("remove me")',
          'a:contains("manage preferences")',
          'a:contains("update preferences")',
        ];

        for (const selector of unsubscribeSelectors) {
          const link = $(selector).first();
          if (link.length > 0) {
            const href = link.attr("href");
            if (href && (href.startsWith("http") || href.startsWith("//"))) {
              let fullUrl = href;
              if (href.startsWith("//")) {
                fullUrl = "https:" + href;
              }
              return fullUrl;
            }
          }
        }
      }

      const unsubscribePatterns = [
        /https?:\/\/[^\s<>"'\)]+unsubscribe[^\s<>"'\)]*/gi,
        /https?:\/\/[^\s<>"'\)]+opt[_-]?out[^\s<>"'\)]*/gi,
        /https?:\/\/[^\s<>"'\)]+remove[^\s<>"'\)]*/gi,
        /https?:\/\/[^\s<>"'\)]+preferences[^\s<>"'\)]*/gi,
      ];

      for (const pattern of unsubscribePatterns) {
        const matches = emailBody.match(pattern);
        if (matches && matches.length > 0) {
          return matches[0];
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async testConnection() {
    if (!this.openai) {
      return { success: false, error: "OpenAI client not initialized" };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Say hello" }],
        max_tokens: 5,
      });

      return {
        success: true,
        message: "OpenAI connection successful",
        response: response.choices[0].message.content,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  }
}

module.exports = new AIService();
