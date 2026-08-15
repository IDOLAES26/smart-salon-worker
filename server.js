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
// Test that Playwright can launch Chromium
// --------------------------------------------------
app.get("/browser-test", async (req, res) => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage();

    await page.goto(BOOKING_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const title = await page.title();

    res.json({
      status: "success",
      browser: "chromium",
      pageTitle: title,
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
// Inspect Sisley booking page and all frames
// --------------------------------------------------
app.get("/availability-test", async (req, res) => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage();

    await page.goto(BOOKING_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    // Give embedded booking widgets time to load
    await page.waitForTimeout(5000);

    const title = await page.title();

    // Get information about every frame/iframe
    const frames = page.frames().map((frame) => ({
      name: frame.name(),
      url: frame.url()
    }));

    // Get visible text from every frame
    const frameTexts = [];

    for (const frame of page.frames()) {
      let text = "";

      try {
        text = await frame.locator("body").innerText({
          timeout: 5000
        });
      } catch (error) {
        text = "";
      }

      frameTexts.push({
        name: frame.name(),
        url: frame.url(),
        text: text
      });
    }

    res.json({
      status: "success",
      pageTitle: title,
      pageUrl: page.url(),
      frameCount: frames.length,
      frames: frames,
      frameTexts: frameTexts
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
// Start server
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`SmartSalon worker running on port ${PORT}`);
});
