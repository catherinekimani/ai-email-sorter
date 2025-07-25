const puppeteer = require("puppeteer");

class UnsubscribeService {
  async unsubscribe(unsubscribeUrl) {
    if (!unsubscribeUrl) {
      return {
        success: false,
        error: "No unsubscribe link available for this email",
        reason: "NO_UNSUBSCRIBE_LINK",
      };
    }

    if (!this.isValidUrl(unsubscribeUrl)) {
      return {
        success: false,
        error: "Invalid unsubscribe URL format",
        reason: "INVALID_URL",
      };
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=VizDisplayCompositor",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-extensions",
        ],
        executablePath:
          process.env.NODE_ENV === "production"
            ? process.env.PUPPETEER_EXECUTABLE_PATH ||
              "/usr/bin/chromium-browser"
            : undefined,
      });

      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      await page.setViewport({ width: 1366, height: 768 });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });
      });

      await page.goto(unsubscribeUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await this.waitFor(page, 3000);

      const pageTitle = await page.title();
      const currentUrl = page.url();

      const alreadyUnsubscribedCheck = await this.checkAlreadyUnsubscribed(
        page
      );
      if (alreadyUnsubscribedCheck.isAlreadyUnsubscribed) {
        return {
          success: true,
          message: alreadyUnsubscribedCheck.message,
          reason: "ALREADY_UNSUBSCRIBED",
          wasAlreadyUnsubscribed: true,
        };
      }

      const strategies = [
        () => this.findAndClickUnsubscribeButton(page),
        () => this.handleEmailFormUnsubscribe(page),
        () => this.handleCheckboxUnsubscribe(page),
        () => this.handleConfirmationDialog(page),
        () => this.handleDropdownUnsubscribe(page),
      ];

      for (let i = 0; i < strategies.length; i++) {
        try {
          const result = await strategies[i]();

          if (result.success) {
            await this.waitFor(page, 3000);
            const finalSuccess = await this.verifyUnsubscribeSuccess(page);

            return {
              success: finalSuccess.success,
              message: finalSuccess.message || result.message,
              strategy: i + 1,
              reason: finalSuccess.success ? "UNSUBSCRIBED" : "UNKNOWN",
            };
          }
        } catch (strategyError) {}
      }

      return {
        success: false,
        error: "No successful unsubscribe action found on the page",
        pageTitle: pageTitle,
        reason: "NO_UNSUBSCRIBE_METHOD_FOUND",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reason: "TECHNICAL_ERROR",
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async checkAlreadyUnsubscribed(page) {
    try {
      const rawContent = await page.content();
      const pageContent = rawContent.toLowerCase();
      const currentUrl = page.url().toLowerCase();

      const alreadyUnsubscribedIndicators = [
        "already unsubscribed",
        "you are already unsubscribed",
        "you have already been unsubscribed",
        "email address is already unsubscribed",
        "you're already unsubscribed",
        "already removed from",
        "already opted out",
        "email not found in our list",
        "not subscribed to this list",
        "no longer subscribed",
        "subscription not found",
      ];

      const foundIndicator = alreadyUnsubscribedIndicators.find((indicator) =>
        pageContent.includes(indicator)
      );

      if (foundIndicator) {
        return {
          isAlreadyUnsubscribed: true,
          message: `Already unsubscribed: Found indicator "${foundIndicator}"`,
        };
      }

      if (
        currentUrl.includes("already") &&
        (currentUrl.includes("unsubscribed") || currentUrl.includes("removed"))
      ) {
        return {
          isAlreadyUnsubscribed: true,
          message:
            "Already unsubscribed: URL indicates already unsubscribed status",
        };
      }

      return { isAlreadyUnsubscribed: false };
    } catch (error) {
      return { isAlreadyUnsubscribed: false };
    }
  }

  async waitFor(page, timeout) {
    try {
      if (typeof page.waitForDelay === "function") {
        await page.waitForDelay(timeout);
      } else if (typeof page.waitForTimeout === "function") {
        await page.waitForTimeout(timeout);
      } else {
        await page.waitFor(timeout);
      }
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
  }

  isValidUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
      return false;
    }
  }

  async findAndClickUnsubscribeButton(page) {
    const directSelectors = [
      'button[class*="unsubscribe" i]',
      'a[href*="unsubscribe" i]',
      'input[type="submit"][value*="unsubscribe" i]',
      '[data-testid*="unsubscribe" i]',
      'button[id*="unsubscribe" i]',
      'a[id*="unsubscribe" i]',
    ];

    for (const selector of directSelectors) {
      try {
        const elements = await page.$$(selector);

        for (const element of elements) {
          const isVisible = await page.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              el.offsetParent !== null
            );
          }, element);

          if (isVisible) {
            const text = await page.evaluate(
              (el) => el.textContent?.toLowerCase() || "",
              element
            );
            await element.click();
            await this.waitFor(page, 2000);
            return {
              success: true,
              message: `Clicked unsubscribe button: ${text}`,
            };
          }
        }
      } catch (e) {
        continue;
      }
    }

    try {
      const allButtons = await page.$$('button, a, input[type="submit"]');

      for (const element of allButtons) {
        try {
          const text = await page.evaluate(
            (el) => el.textContent?.toLowerCase() || "",
            element
          );
          const isVisible = await page.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              el.offsetParent !== null
            );
          }, element);

          if (
            isVisible &&
            (text.includes("unsubscribe") ||
              text.includes("opt out") ||
              text.includes("remove me") ||
              text.includes("stop emails") ||
              text.includes("manage preferences"))
          ) {
            await element.click();
            await this.waitFor(page, 2000);
            return {
              success: true,
              message: `Clicked unsubscribe button: ${text}`,
            };
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {}

    return { success: false, message: "No unsubscribe button found" };
  }

  async handleEmailFormUnsubscribe(page) {
    const emailInputs = await page.$$(
      'input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[id*="email" i]'
    );

    if (emailInputs.length === 0) {
      return { success: false, message: "No email input found" };
    }

    try {
      await emailInputs[0].click({ clickCount: 3 });
      await emailInputs[0].type("user@example.com", { delay: 100 });

      await this.waitFor(page, 1000);

      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        "button[form]",
        'input[type="button"][onclick*="submit"]',
      ];

      let submitButton = null;

      for (const selector of submitSelectors) {
        try {
          const buttons = await page.$$(selector);
          for (const btn of buttons) {
            const isVisible = await page.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                rect.width > 0 &&
                rect.height > 0
              );
            }, btn);

            if (isVisible) {
              const btnText = await page.evaluate(
                (el) => el.textContent?.trim() || el.value || "",
                btn
              );
              submitButton = btn;
              break;
            }
          }
          if (submitButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!submitButton) {
        const allButtons = await page.$$("button, input[type='button']");

        for (const button of allButtons) {
          try {
            const text = await page.evaluate(
              (el) =>
                (
                  el.textContent?.toLowerCase() ||
                  el.value?.toLowerCase() ||
                  ""
                ).trim(),
              button
            );

            const isVisible = await page.evaluate((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                rect.width > 0 &&
                rect.height > 0
              );
            }, button);

            const submitKeywords = [
              "submit",
              "unsubscribe",
              "confirm",
              "save",
              "update",
              "continue",
              "proceed",
              "send",
              "go",
              "next",
              "apply",
            ];

            if (
              isVisible &&
              submitKeywords.some((keyword) => text.includes(keyword))
            ) {
              submitButton = button;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (submitButton) {
        const buttonText = await page.evaluate(
          (el) => el.textContent?.trim() || el.value || "Unknown Button",
          submitButton
        );

        const currentUrl = page.url();

        await submitButton.click();

        await this.waitFor(page, 3000);

        const newUrl = page.url();

        return {
          success: true,
          message: `Submitted email form via "${buttonText}"${
            newUrl !== currentUrl ? " (page redirected)" : ""
          }`,
        };
      }

      try {
        await emailInputs[0].press("Enter");
        await this.waitFor(page, 2000);
        return {
          success: true,
          message: "Submitted email form using Enter key",
        };
      } catch (enterError) {}

      return {
        success: false,
        message: "Email input found but no working submit method",
      };
    } catch (error) {
      return { success: false, message: `Email form error: ${error.message}` };
    }
  }

  async handleCheckboxUnsubscribe(page) {
    const checkboxes = await page.$$('input[type="checkbox"]');
    let actionTaken = false;

    for (const checkbox of checkboxes) {
      try {
        const label = await page.evaluate((el) => {
          const id = el.id;
          const labelEl = id
            ? document.querySelector(`label[for="${id}"]`)
            : el.closest("label");
          return labelEl ? labelEl.textContent.toLowerCase() : "";
        }, checkbox);

        const isChecked = await page.evaluate((el) => el.checked, checkbox);

        if (
          label.includes("email") ||
          label.includes("newsletter") ||
          label.includes("updates")
        ) {
          if (isChecked) {
            await checkbox.click();
            actionTaken = true;
          }
        }

        if (
          (label.includes("unsubscribe") || label.includes("opt out")) &&
          !isChecked
        ) {
          await checkbox.click();
          actionTaken = true;
        }
      } catch (e) {
        continue;
      }
    }

    if (actionTaken) {
      const submitSelectors = ['button[type="submit"]', 'input[type="submit"]'];

      let submitBtn = null;

      for (const selector of submitSelectors) {
        try {
          submitBtn = await page.$(selector);
          if (submitBtn) break;
        } catch (e) {
          continue;
        }
      }

      if (!submitBtn) {
        const allButtons = await page.$$("button");
        for (const button of allButtons) {
          try {
            const text = await page.evaluate(
              (el) => el.textContent?.toLowerCase() || "",
              button
            );
            if (
              text.includes("save") ||
              text.includes("update") ||
              text.includes("submit")
            ) {
              submitBtn = button;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (submitBtn) {
        await submitBtn.click();
        await this.waitFor(page, 2000);
        return { success: true, message: "Updated checkbox preferences" };
      }
    }

    return { success: false, message: "No relevant checkboxes found" };
  }

  async handleConfirmationDialog(page) {
    try {
      page.on("dialog", async (dialog) => {
        await dialog.accept();
      });

      const allButtons = await page.$$('button, a, input[type="submit"]');

      for (const element of allButtons) {
        try {
          const text = await page.evaluate(
            (el) => el.textContent?.toLowerCase() || "",
            element
          );
          const isVisible = await page.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.display !== "none" && style.visibility !== "hidden";
          }, element);

          if (
            isVisible &&
            (text.includes("confirm") ||
              text.includes("yes") ||
              text.includes("proceed") ||
              text.includes("continue"))
          ) {
            await element.click();
            await this.waitFor(page, 2000);
            return { success: true, message: `Confirmed unsubscribe: ${text}` };
          }
        } catch (e) {
          continue;
        }
      }

      return { success: false, message: "No confirmation dialog found" };
    } catch (error) {
      return {
        success: false,
        message: `Confirmation error: ${error.message}`,
      };
    }
  }

  async handleDropdownUnsubscribe(page) {
    try {
      const selects = await page.$$("select");

      for (const select of selects) {
        const options = await page.$$eval("select option", (options) =>
          options.map((option) => ({
            value: option.value,
            text: option.textContent.toLowerCase(),
          }))
        );

        const unsubscribeOption = options.find(
          (opt) =>
            opt.text.includes("unsubscribe") ||
            opt.text.includes("opt out") ||
            opt.text.includes("none") ||
            opt.text.includes("no emails")
        );

        if (unsubscribeOption) {
          await page.select("select", unsubscribeOption.value);

          const submitBtn = await page.$(
            'button[type="submit"], input[type="submit"]'
          );
          if (submitBtn) {
            await submitBtn.click();
            await this.waitFor(page, 2000);
            return {
              success: true,
              message: `Selected unsubscribe option: ${unsubscribeOption.text}`,
            };
          }
        }
      }

      return { success: false, message: "No unsubscribe dropdown found" };
    } catch (error) {
      return { success: false, message: `Dropdown error: ${error.message}` };
    }
  }

  async verifyUnsubscribeSuccess(page) {
    try {
      await this.waitFor(page, 5000);

      const pageContent = await page.content();
      const currentUrl = page.url().toLowerCase();
      const pageTitle = await page.title();

      const successIndicators = [
        "successfully unsubscribed",
        "you have been unsubscribed",
        "unsubscribe successful",
        "removed from list",
        "no longer receive",
        "email preferences updated",
        "subscription cancelled",
        "unsubscription complete",
        "you're now unsubscribed",
        "successfully removed",
        "preferences have been updated",
        "thank you for updating",
        "changes have been saved",
        "settings updated",
        "communication preferences updated",
        "you will no longer receive",
        "email address has been removed",
        "opted out successfully",
        "request has been processed",
        "thank you",
        "confirmation",
        "updated successfully",
      ];

      const contentLower = pageContent.toLowerCase();
      const titleLower = pageTitle.toLowerCase();

      const foundContentIndicator = successIndicators.find((indicator) =>
        contentLower.includes(indicator)
      );

      if (foundContentIndicator) {
        return {
          success: true,
          message: `Success confirmed: Found indicator "${foundContentIndicator}"`,
        };
      }

      const foundTitleIndicator = successIndicators.find((indicator) =>
        titleLower.includes(indicator)
      );

      if (foundTitleIndicator) {
        return {
          success: true,
          message: `Success confirmed: Title contains "${foundTitleIndicator}"`,
        };
      }

      const urlSuccessIndicators = [
        "success",
        "unsubscribed",
        "complete",
        "confirmation",
        "updated",
        "preferences",
        "communication-preferences",
      ];

      const foundUrlIndicator = urlSuccessIndicators.find((indicator) =>
        currentUrl.includes(indicator)
      );

      if (foundUrlIndicator) {
        return {
          success: true,
          message: `Success confirmed: URL contains "${foundUrlIndicator}"`,
        };
      }

      if (currentUrl !== page.url() && currentUrl.includes("preferences")) {
        return {
          success: true,
          message:
            "Success inferred: Redirected to preferences page after form submission",
        };
      }

      try {
        const hasSuccessClass = await page.$(
          ".success, .alert-success, .message-success, .confirmation"
        );
        if (hasSuccessClass) {
          const successText = await page.evaluate(
            (el) => el.textContent,
            hasSuccessClass
          );
          return {
            success: true,
            message: `Success confirmed: Found success element with text "${successText}"`,
          };
        }
      } catch (e) {}

      const contentSnippet = contentLower.substring(0, 500);
      console.log(`[UNSUBSCRIBE] Page content snippet: ${contentSnippet}`);

      return {
        success: false,
        message:
          "No clear success indicators found - manual verification may be needed",
      };
    } catch (error) {
      return {
        success: false,
        message: `Verification error: ${error.message}`,
      };
    }
  }
}

module.exports = new UnsubscribeService();
