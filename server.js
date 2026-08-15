const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOOKING_URL = "https://www.sisleynailsalon1.com/booking/";

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "SmartSalon browser worker is running"
  });
});

app.get("/step2-test", async (req, res) => {
  let browser;

  const requestedService =
    req.query.service || "Full set: hybrid";

  const actionLog = [];

  try {
    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1200
      }
    });

    // 1. Open SmartSalon
    await page.goto(BOOKING_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    actionLog.push({
      step: 1,
      action: "open_booking_page",
      result: "success"
    });

    await page.waitForTimeout(2500);

    // 2. Book an appointment
    const bookAppointment = page
      .getByText("Book an appointment", {
        exact: true
      })
      .first();

    await bookAppointment.waitFor({
      state: "visible",
      timeout: 15000
    });

    await bookAppointment.click();

    actionLog.push({
      step: 2,
      action: "click_book_appointment",
      result: "success"
    });

    // 3. Wait for service screen
    await page
      .getByText("Select Services", {
        exact: true
      })
      .waitFor({
        state: "visible",
        timeout: 15000
      });

    await page.waitForTimeout(1500);

    // 4. Click Eyelash extension category
    const eyelashCategory = page
      .getByText("Eyelash extension", {
        exact: true
      })
      .first();

    await eyelashCategory.waitFor({
      state: "visible",
      timeout: 15000
    });

    await eyelashCategory.click();

    actionLog.push({
      step: 3,
      action: "select_category",
      target: "Eyelash extension",
      result: "success"
    });

    await page.waitForTimeout(1500);

    // 5. Find service
    const serviceText = page
      .getByText(requestedService, {
        exact: true
      })
      .first();

    await serviceText.waitFor({
      state: "visible",
      timeout: 15000
    });

    await serviceText.scrollIntoViewIfNeeded();

    actionLog.push({
      step: 4,
      action: "find_service",
      target: requestedService,
      result: "success"
    });

    // 6. Find service card
    const serviceCard = serviceText
      .locator(
        "xpath=ancestor::div[contains(@class,'grid') and contains(@class,'grid-cols-9')][1]"
      );

    // 7. Click the actual + control
    const addControl = serviceCard
      .locator("div.aspect-square.cursor-pointer")
      .first();

    await addControl.waitFor({
      state: "visible",
      timeout: 10000
    });

    await addControl.click();

    actionLog.push({
      step: 5,
      action: "add_service",
      target: requestedService,
      result: "success"
    });

    await page.waitForTimeout(2000);

    // 8. Wait for a VISIBLE + ENABLED Continue button
    await page.waitForFunction(() => {
      const buttons = Array.from(
        document.querySelectorAll("button")
      );

      return buttons.some((button) => {
        const text =
          (button.innerText || "").trim();

        const rect =
          button.getBoundingClientRect();

        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          window.getComputedStyle(button).visibility !== "hidden" &&
          window.getComputedStyle(button).display !== "none";

        return (
          text === "Continue" &&
          !button.disabled &&
          visible
        );
      });
    }, {
      timeout: 15000
    });

    // 9. Click that exact visible Continue button
    const continueClicked =
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll("button")
        );

        const button = buttons.find((button) => {
          const text =
            (button.innerText || "").trim();

          const rect =
            button.getBoundingClientRect();

          const style =
            window.getComputedStyle(button);

          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none";

          return (
            text === "Continue" &&
            !button.disabled &&
            visible
          );
        });

        if (!button) {
          return false;
        }

        button.click();
        return true;
      });

    if (!continueClicked) {
      throw new Error(
        "Visible enabled Continue button was not found"
      );
    }

    actionLog.push({
      step: 6,
      action: "continue_to_technician",
      result: "success"
    });

    // 10. Wait for technician screen
    await page
      .getByText("Select Technician", {
        exact: true
      })
      .waitFor({
        state: "visible",
        timeout: 15000
      });

    await page.waitForTimeout(1500);

    // 11. Read technician screen
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    actionLog.push({
      step: 7,
      action: "technician_screen_loaded",
      result: "success"
    });

    res.json({
      status: "success",
      step: "technician_screen",
      requestedService,
      pageUrl: page.url(),
      bodyText,
      actionLog
    });

  } catch (error) {
    actionLog.push({
      action: "error",
      result: "failed",
      message: error.message
    });

    res.status(500).json({
      status: "error",
      requestedService,
      message: error.message,
      actionLog
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(
    `SmartSalon worker running on port ${PORT}`
  );
});
