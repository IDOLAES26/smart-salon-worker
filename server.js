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

app.get("/service-debug", async (req, res) => {
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

    await page.goto(BOOKING_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(2500);

    // Open booking
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

    // Wait for services
    await page.getByText("Select Services", {
      exact: true
    }).waitFor({
      state: "visible",
      timeout: 15000
    });

    await page.waitForTimeout(1500);

    // Click Eyelash extension category
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

    await page.waitForTimeout(2000);

    // Find requested service
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

    // Inspect service element and ancestors
    const debug = await serviceText.evaluate((el) => {
      const results = [];

      let current = el;

      for (let i = 0; i < 6 && current; i++) {
        results.push({
          level: i,
          tag: current.tagName,
          className:
            typeof current.className === "string"
              ? current.className
              : "",
          text:
            (current.innerText || current.textContent || "")
              .trim()
              .slice(0, 1000),
          html:
            current.outerHTML.slice(0, 5000)
        });

        current = current.parentElement;
      }

      return results;
    });

    // Get every button near the service
    const allButtons = await page
      .locator("button")
      .evaluateAll((buttons) =>
        buttons.map((b, index) => ({
          index,
          text:
            (b.innerText || b.textContent || "").trim(),
          disabled: b.disabled,
          ariaLabel:
            b.getAttribute("aria-label") || "",
          className:
            typeof b.className === "string"
              ? b.className
              : "",
          html: b.outerHTML.slice(0, 2000)
        }))
      );

    res.json({
      status: "success",
      requestedService,
      debug,
      allButtons
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      requestedService,
      message: error.message
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
