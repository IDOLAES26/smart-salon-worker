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
// Inspect booking page DOM, HTML and scripts
// --------------------------------------------------
app.get("/page-debug", async (req, res) => {
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

    await page.waitForTimeout(5000);

    const title = await page.title();
    const html = await page.content();

    const bodyText = await page.locator("body").innerText().catch(() => "");

    const scripts = await page.locator("script").evaluateAll((nodes) =>
      nodes.map((node) => ({
        src: node.src || "",
        type: node.type || "",
        textPreview: node.src ? "" : (node.textContent || "").slice(0, 500)
      }))
    );

    const links = await page.locator("link").evaluateAll((nodes) =>
      nodes.map((node) => ({
        rel: node.rel || "",
        href: node.href || ""
      }))
    );

    const iframes = await page.locator("iframe").evaluateAll((nodes) =>
      nodes.map((node) => ({
        src: node.src || "",
        title: node.title || "",
        name: node.name || ""
      }))
    );

    const buttons = await page.locator("button").evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: (node.innerText || node.textContent || "").trim(),
        ariaLabel: node.getAttribute("aria-label") || ""
      }))
    );

    const inputs = await page.locator("input").evaluateAll((nodes) =>
      nodes.map((node) => ({
        type: node.type || "",
        name: node.name || "",
        placeholder: node.placeholder || ""
      }))
    );

    res.json({
      status: "success",
      pageTitle: title,
      pageUrl: page.url(),
      bodyText: bodyText,
      htmlPreview: html.slice(0, 20000),
      scriptCount: scripts.length,
      scripts: scripts,
      linkCount: links.length,
      links: links,
      iframeCount: iframes.length,
      iframes: iframes,
      buttonCount: buttons.length,
      buttons: buttons,
      inputCount: inputs.length,
      inputs: inputs
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
