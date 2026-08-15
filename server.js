const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOOKING_URL = "https://www.sisleynailsalon1.com/booking/";

// --------------------------------------------------
// Health check
// --------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "SmartSalon browser worker is running"
  });
});

// --------------------------------------------------
// Browser test
// --------------------------------------------------
app.get("/browser-test", async (req, res) => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage();

    await page.goto(BOOKING_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    res.json({
      status: "success",
      browser: "chromium",
      pageTitle: await page.title(),
      url: page.url()
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// --------------------------------------------------
// Step 2:
// Select category + service and reach technician screen
//
// Example:
// /step2-test?service=Full%20set:%20hybrid
// --------------------------------------------------
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

    // 1. Open booking page
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

    // 2. Click Book an appointment
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

    // 3. Wait for Select Services
    await page.getByText("Select Services", {
      exact: true
    }).waitFor({
      state: "visible",
      timeout: 15000
    });

    await page.waitForTimeout(2000);

    // 4. Select Eyelash extension category
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

    await page.waitForTimeout(2000);

    // 5. Find requested service
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

    // 6. Find service card containing this service
    const serviceCard = serviceText
      .locator("xpath=ancestor::*[.//button][1]")
      .first();

    // Find ENABLED button inside that card
    const addButton = serviceCard
      .locator("button:not([disabled])")
      .first();

    await addButton.waitFor({
      state: "visible",
      timeout: 10000
    });

    await addButton.click();

    actionLog.push({
      step: 5,
      action: "add_service",
      target: requestedService,
      result: "success"
    });

    await page.waitForTimeout(1500);

    // 7. Click Continue
    const continueButton = page
      .getByRole("button", {
        name: "Continue",
        exact: true
      })
      .last();

    await continueButton.waitFor({
      state: "visible",
      timeout: 10000
    });

    await continueButton.waitFor({
      state: "attached",
      timeout: 10000
    });

    // Wait until Continue is enabled
    await page.waitForFunction(() => {
      const buttons = Array.from(
        document.querySelectorAll("button")
      );

      const button = buttons.find(
        (b) =>
          b.innerText.trim() === "Continue" &&
          !b.disabled
      );

      return !!button;
    }, null, {
      timeout: 10000
    });

    await continueButton.click();

    actionLog.push({
      step: 6,
      action: "continue_to_technician",
      result: "success"
    });

    // 8. Wait for technician screen
    await page.getByText("Select Technician", {
      exact: true
    }).waitFor({
      state: "visible",
      timeout: 15000
    });

    await page.waitForTimeout(1500);

    // 9. Read technician screen
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    const buttons = await page
      .locator("button")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            text:
              (
                node.innerText ||
                node.textContent ||
                ""
              ).trim(),
            disabled: node.disabled,
            ariaLabel:
              node.getAttribute("aria-label") || ""
          }))
          .filter(
            (item) =>
              item.text ||
              item.ariaLabel
          )
      );

    res.json({
      status: "success",
      step: "technician_screen",
      requestedService: requestedService,
      pageUrl: page.url(),
      bodyText: bodyText,
      buttons: buttons,
      actionLog: actionLog
    });

  } catch (error) {
    actionLog.push({
      action: "error",
      result: "failed",
      message: error.message
    });

    res.status(500).json({
      status: "error",
      step: "select_service",
      requestedService: requestedService,
      message: error.message,
      actionLog: actionLog
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(
    `SmartSalon worker running on port ${PORT}`
  );
});
