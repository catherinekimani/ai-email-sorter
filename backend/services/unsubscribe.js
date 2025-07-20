const puppeteer = require("puppeteer");

class UnsubscribeService {
  async unsubscribe(unsubscribeUrl) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      );

      await page.goto(unsubscribeUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      const unsubscribeActions = [
        async () => {
          const buttons = await page.$$('button, input[type="submit"], a');
          for (const button of buttons) {
            const text = await page.evaluate(
              (el) => el.textContent?.toLowerCase() || "",
              button
            );
            if (
              text.includes("unsubscribe") ||
              text.includes("remove") ||
              text.includes("opt out")
            ) {
              await button.click();
              return true;
            }
          }
          return false;
        },

        async () => {
          const emailInputs = await page.$$(
            'input[type="email"], input[name*="email"]'
          );
          if (emailInputs.length > 0) {
            await emailInputs[0].type("test@example.com");

            const submitButton = await page.$(
              'button[type="submit"], input[type="submit"]'
            );
            if (submitButton) {
              await submitButton.click();
              return true;
            }
          }
          return false;
        },

        async () => {
          const checkboxes = await page.$$('input[type="checkbox"]');
          let found = false;
          for (const checkbox of checkboxes) {
            const isChecked = await page.evaluate((el) => el.checked, checkbox);
            if (isChecked) {
              await checkbox.click();
              found = true;
            }
          }

          if (found) {
            const submitButton = await page.$(
              'button[type="submit"], input[type="submit"]'
            );
            if (submitButton) {
              await submitButton.click();
              return true;
            }
          }
          return false;
        },
      ];

      for (const action of unsubscribeActions) {
        try {
          const success = await action();
          if (success) {
            await page.waitForTimeout(3000);
            return true;
          }
        } catch (actionError) {}
      }

      return false;
    } catch (error) {
      return false;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = new UnsubscribeService();
