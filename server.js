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
// Open booking page and click "Book an appointment"
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

    const buttons = await page
      .locator("button")
      .evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            text: (node.innerText || node.textContent || "").trim(),
            ariaLabel: node.getAttribute("aria-label") || ""
          }))
          .filter((item) => item.text || item.ariaLabel)
      );

    res.json({
      status: "success",
      step: "book_appointment_clicked",
      pageTitle: await page.title(),
      pageUrl: page.url(),
      bodyText: bodyText,
      buttons: buttons
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      step: "book_appointment",
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
  console.log(`SmartSalon worker running on port ${PORT}`);
});
