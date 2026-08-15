const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOOKING_URL = "https://www.sisleynailsalon1.com/booking/";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRequestedDate(dateString) {
  if (!dateString) {
    throw new Error(
      "Missing date. Use YYYY-MM-DD, for example 2026-08-17."
    );
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    throw new Error(
      "Invalid date format. Use YYYY-MM-DD."
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Noon UTC avoids date-shift problems when formatting.
  const date = new Date(
    Date.UTC(year, month - 1, day, 12, 0, 0)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date.");
  }

  return {
    date,
    year,
    month,
    day
  };
}

function getDateLabels(date) {
  return {
    weekdayShort: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "UTC"
    }).format(date),

    weekdayLong: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "UTC"
    }).format(date),

    monthShort: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC"
    }).format(date),

    monthLong: new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: "UTC"
    }).format(date),

    day: String(date.getUTCDate())
  };
}

async function clickVisibleEnabledContinue(page) {
  await page.waitForFunction(() => {
    const buttons = Array.from(
      document.querySelectorAll("button")
    );

    return buttons.some((button) => {
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
  }, {
    timeout: 15000
  });

  const clicked = await page.evaluate(() => {
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

  if (!clicked) {
    throw new Error(
      "Visible enabled Continue button was not found."
    );
  }
}

async function selectRequestedDate(page, requestedDate) {
  const parsed =
    parseRequestedDate(requestedDate);

  const labels =
    getDateLabels(parsed.date);

  /*
    SmartSalon displays a row of date cards.

    We first look for a visible clickable element whose
    text contains the requested day number and weekday.
  */

  async function tryClickVisibleDate() {
    return await page.evaluate(
      ({ weekdayShort, weekdayLong, day }) => {
        const candidates = Array.from(
          document.querySelectorAll(
            "button, [role='button'], div.cursor-pointer"
          )
        );

        const visibleCandidates =
          candidates.filter((element) => {
            const rect =
              element.getBoundingClientRect();

            const style =
              window.getComputedStyle(element);

            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          });

        const candidate =
          visibleCandidates.find((element) => {
            const text =
              (element.innerText || "")
                .replace(/\s+/g, " ")
                .trim();

            const hasDay =
              new RegExp(
                `(^|\\s)${day}(\\s|$)`
              ).test(text);

            const hasWeekday =
              text.includes(weekdayShort) ||
              text.includes(weekdayLong);

            return hasDay && hasWeekday;
          });

        if (!candidate) {
          return false;
        }

        candidate.click();
        return true;
      },
      {
        weekdayShort: labels.weekdayShort,
        weekdayLong: labels.weekdayLong,
        day: labels.day
      }
    );
  }

  /*
    Try the currently visible week first.
  */

  let clicked =
    await tryClickVisibleDate();

  if (clicked) {
    await page.waitForTimeout(1500);
    return true;
  }

  /*
    If the requested date is not in the visible week,
    look for the right-arrow navigation control.

    We inspect visible buttons containing an SVG and
    click the last suitable small navigation button.
  */

  for (let attempt = 0; attempt < 16; attempt++) {
    const advanced =
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll("button")
        );

        const candidates =
          buttons.filter((button) => {
            const rect =
              button.getBoundingClientRect();

            const style =
              window.getComputedStyle(button);

            const visible =
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden";

            const hasSvg =
              !!button.querySelector("svg");

            const text =
              (button.innerText || "")
                .trim();

            /*
              Date navigation arrows generally have
              no text and contain an SVG.
            */
            return (
              visible &&
              hasSvg &&
              text === ""
            );
          });

        if (!candidates.length) {
          return false;
        }

        /*
          On the SmartSalon time screen the forward
          arrow is typically one of the right-most
          SVG-only buttons.
        */

        candidates.sort((a, b) => {
          return (
            b.getBoundingClientRect().left -
            a.getBoundingClientRect().left
          );
        });

        const forward =
          candidates[0];

        forward.click();
        return true;
      });

    if (!advanced) {
      break;
    }

    await page.waitForTimeout(1000);

    clicked =
      await tryClickVisibleDate();

    if (clicked) {
      await page.waitForTimeout(1500);
      return true;
    }
  }

  throw new Error(
    `Could not find requested date ${requestedDate} on SmartSalon.`
  );
}

function extractTimeSlots(text) {
  const normalized =
    String(text || "")
      .replace(/\u00a0/g, " ");

  const matches =
    normalized.match(
      /\b(?:0?[1-9]|1[0-2]):[0-5]\d\s?(?:AM|PM)\b/gi
    ) || [];

  const unique = [];

  for (const time of matches) {
    const cleaned =
      time
        .replace(/\s+/g, " ")
        .toUpperCase()
        .trim();

    if (!unique.includes(cleaned)) {
      unique.push(cleaned);
    }
  }

  return unique;
}

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message:
      "SmartSalon browser worker is running"
  });
});

// --------------------------------------------------
// Real availability endpoint
//
// Example:
// /availability?service=Full%20set:%20hybrid&technician=Noel&date=2026-08-17
// --------------------------------------------------

app.get("/availability", async (req, res) => {
  let browser;

  const requestedService =
    req.query.service || "Full set: hybrid";

  const requestedTechnician =
    req.query.technician || "Noel";

  const requestedDate =
    req.query.date;

  const actionLog = [];

  try {
    parseRequestedDate(requestedDate);

    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1200
      }
    });

    // ----------------------------------------------
    // 1. Open SmartSalon
    // ----------------------------------------------

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

    // ----------------------------------------------
    // 2. Book an appointment
    // ----------------------------------------------

    const bookAppointment =
      page
        .getByText(
          "Book an appointment",
          { exact: true }
        )
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

    // ----------------------------------------------
    // 3. Wait for services
    // ----------------------------------------------

    await page
      .getByText(
        "Select Services",
        { exact: true }
      )
      .waitFor({
        state: "visible",
        timeout: 15000
      });

    await page.waitForTimeout(1500);

    // ----------------------------------------------
    // 4. Select Eyelash extension
    // ----------------------------------------------

    const eyelashCategory =
      page
        .getByText(
          "Eyelash extension",
          { exact: true }
        )
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

    // ----------------------------------------------
    // 5. Find requested service
    // ----------------------------------------------

    const serviceText =
      page
        .getByText(
          requestedService,
          { exact: true }
        )
        .first();

    await serviceText.waitFor({
      state: "visible",
      timeout: 15000
    });

    await serviceText
      .scrollIntoViewIfNeeded();

    actionLog.push({
      step: 4,
      action: "find_service",
      target: requestedService,
      result: "success"
    });

    // ----------------------------------------------
    // 6. Select service
    // ----------------------------------------------

    const serviceCard =
      serviceText.locator(
        "xpath=ancestor::div[contains(@class,'grid') and contains(@class,'grid-cols-9')][1]"
      );

    const addControl =
      serviceCard
        .locator(
          "div.aspect-square.cursor-pointer"
        )
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

    // ----------------------------------------------
    // 7. Continue to technician
    // ----------------------------------------------

    await clickVisibleEnabledContinue(page);

    actionLog.push({
      step: 6,
      action: "continue_to_technician",
      result: "success"
    });

    // ----------------------------------------------
    // 8. Wait for technician screen
    // ----------------------------------------------

    await page
      .getByText(
        "Select Technician",
        { exact: true }
      )
      .waitFor({
        state: "visible",
        timeout: 15000
      });

    await page.waitForTimeout(1500);

    // ----------------------------------------------
    // 9. Select Noel
    // ----------------------------------------------

    const technician =
      page
        .getByText(
          requestedTechnician,
          { exact: true }
        )
        .first();

    await technician.waitFor({
      state: "visible",
      timeout: 15000
    });

    await technician.click();

    actionLog.push({
      step: 7,
      action: "select_technician",
      target: requestedTechnician,
      result: "success"
    });

    await page.waitForTimeout(1500);

    // ----------------------------------------------
    // 10. Continue to time screen
    // ----------------------------------------------

    await clickVisibleEnabledContinue(page);

    actionLog.push({
      step: 8,
      action: "continue_to_time",
      result: "success"
    });

    // ----------------------------------------------
    // 11. Wait for Select Time
    // ----------------------------------------------

    await page
      .getByText(
        "Select Time",
        { exact: true }
      )
      .waitFor({
        state: "visible",
        timeout: 15000
      });

    await page.waitForTimeout(1500);

    // ----------------------------------------------
    // 12. Select requested date
    // ----------------------------------------------

    await selectRequestedDate(
      page,
      requestedDate
    );

    actionLog.push({
      step: 9,
      action: "select_date",
      target: requestedDate,
      result: "success"
    });

    await page.waitForTimeout(2000);

    // ----------------------------------------------
    // 13. Read availability
    // ----------------------------------------------

    const bodyText =
      await page
        .locator("body")
        .innerText()
        .catch(() => "");

    const slots =
      extractTimeSlots(bodyText);

    actionLog.push({
      step: 10,
      action: "read_available_slots",
      count: slots.length,
      result: "success"
    });

    // ----------------------------------------------
    // Response
    // ----------------------------------------------

    res.json({
      status:
        slots.length > 0
          ? "success"
          : "no_availability",

      service:
        requestedService,

      technician:
        requestedTechnician,

      date:
        requestedDate,

      slotCount:
        slots.length,

      slots:
        slots,

      actionLog:
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

      service:
        requestedService,

      technician:
        requestedTechnician,

      date:
        requestedDate || null,

      message:
        error.message,

      actionLog:
        actionLog
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
