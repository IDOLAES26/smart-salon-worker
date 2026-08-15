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

    // 3. Wait for services screen
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

    // 5. Locate requested service
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

    // 6. Find the service card
    const serviceCard = serviceText
      .locator(
        "xpath=ancestor::div[contains(@class,'grid') and contains(@class,'grid-cols-9')][1]"
      );

    // 7. Click SmartSalon's actual "+" control
    // It is a DIV, not a button.
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

    await page.waitForTimeout(1500);

    // 8. Find Continue
    const continueButton = page
      .getByText("Continue", {
        exact: true
      })
      .last();

    await continueButton.waitFor({
      state: "visible",
      timeout: 10000
    });

    await continueButton.click();

    actionLog.push({
      step: 6,
      action: "continue_to_technician",
      result: "success"
    });

    // 9. Wait for technician screen
    await page
      .getByText("Select Technician", {
        exact: true
      })
      .waitFor({
        state: "visible",
        timeout: 15000
      });

    await page.waitForTimeout(1500);

    // 10. Read screen text
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    res.json({
      status: "success",
      step: "technician_screen",
      requestedService,
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
