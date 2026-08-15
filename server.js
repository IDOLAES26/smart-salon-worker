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
// Step 1:
// Open booking page and reach services
// --------------------------------------------------
app.get("/step1-test", async (req, res) => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1000
      }
    });

    await page.goto(BOOKING_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

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

    await page.waitForTimeout(4000);

    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    res.json({
      status: "success",
      step: "services_screen",
      bodyText: bodyText
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      step: "services_screen",
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
// Select a requested service and reach technician screen
//
// Example:
// /step2-test?service=Full%20set:%20hybrid
// --------------------------------------------------
app.get("/step2-test", async (req, res) => {
  let browser;

  const requestedService =
    req.query.service || "Full set: hybrid";

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

    await page.waitForTimeout(3000);

    // 2. Click "Book an appointment"
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

    // 3. Wait for services page
    await page.getByText("Select Services", {
      exact: true
    }).waitFor({
      state: "visible",
      timeout: 15000
    });

    await page.waitForTimeout(2500);

    // 4. Find the exact service name
    const serviceText = page
      .getByText(requestedService, {
        exact: true
      })
      .first();

    await serviceText.waitFor({
      state: "visible",
      timeout: 15000
    });

    // Scroll it into view
    await serviceText.scrollIntoViewIfNeeded();

    // 5. Find the nearest ancestor containing a button
    //    This should be the service card containing the "+" button.
    const serviceCard = serviceText
      .locator("xpath=ancestor::*[.//button][1]")
      .first();

    const addButton = serviceCard
      .locator("button")
      .first();

    await addButton.click();

    await page.waitForTimeout(1500);

    // 6. Click Continue
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

    await continueButton.click();

    // 7. Wait for technician screen
    await page.getByText("Select Technician", {
      exact: true
    }).waitFor({
      state: "visible",
      timeout: 15000
    });

    await page.waitForTimeout(2000);

    // 8. Read the technician screen
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");

    const buttons = await page
      .locator("button")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            text: (
              node.innerText ||
              node.textContent ||
              ""
            ).trim(),
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
      buttons: buttons
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      step: "select_service",
      requestedService: requestedService,
      message: error.message
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
