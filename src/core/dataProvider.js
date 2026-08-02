import YahooFinance from "yahoo-finance2";
import fs from "fs/promises";
import cron from "node-cron";

const FRED_API_KEY = "c6b3e6442d500c408624f67d2fe73369";
const FED_FUNDS_RATE_SERIES = "DFEDTARU";
const CPI_SERIES = "CPIAUCSL";
const DATA_FILE = "./data.json";

const yahooFinance = new YahooFinance();

async function fetchMacroData() {
  let fedRate = null;
  let inflation = null;
  let dividend = null;

  try {
    const fedRes = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${FED_FUNDS_RATE_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`,
    );
    const fedData = await fedRes.json();
    const latest = fedData.observations?.[0];
    if (latest && latest.value && latest.value !== ".") {
      fedRate = parseFloat(latest.value);
    }

    const cpiRes = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${CPI_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=13`,
    );
    const cpiData = await cpiRes.json();
    const observations = cpiData.observations || [];
    if (observations.length >= 2) {
      const current = parseFloat(observations[0].value);
      const yearAgo = parseFloat(
        observations[12]?.value || observations[observations.length - 1].value,
      );
      if (current && yearAgo) {
        inflation = ((current - yearAgo) / yearAgo) * 100;
      }
    }

    try {
      const summary = await yahooFinance.quoteSummary("TLT", {
        modules: ["summaryDetail"],
      });
      const dividendRate = summary?.summaryDetail?.trailingAnnualDividendRate;
      if (dividendRate) {
        dividend = parseFloat(dividendRate);
      }
    } catch (divErr) {
      console.error("Ошибка получения дивиденда:", divErr);
    }
  } catch (err) {
    console.error("Ошибка получения макроданных:", err);
  }

  return { fedRate, inflation, dividend };
}

async function loadData() {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

async function upsertTodayEntry(updates) {
  const today = new Date().toISOString().split("T")[0];
  let data = await loadData();
  const index = data.findIndex((entry) => entry.date === today);

  if (index === -1) {
    data.push({
      date: today,
      open: null,
      close: null,
      fedRate: null,
      inflation: null,
      dividend: null,
      ...updates,
    });
  } else {
    data[index] = { ...data[index], ...updates };
  }

  await saveData(data);
  console.log(`✅ Запись за ${today} обновлена:`, updates);
}

async function saveOpenAndMacro() {
  console.log("⏰ 16:30 – запись open и макроданных");
  try {
    const quote = await yahooFinance.quote("TLT");
    const openPrice = quote.regularMarketOpen;
    if (!openPrice) {
      console.warn("⚠️ Цена открытия не получена, пропускаем");
      return;
    }

    const macro = await fetchMacroData();
    await upsertTodayEntry({
      open: openPrice,
      fedRate: macro.fedRate,
      inflation: macro.inflation,
      dividend: macro.dividend,
    });
  } catch (err) {
    console.error("❌ Ошибка в saveOpenAndMacro:", err);
  }
}

async function saveClose() {
  console.log("⏰ 23:00 – запись close");
  try {
    const quote = await yahooFinance.quote("TLT");
    const closePrice = quote.regularMarketPrice;
    if (!closePrice) {
      console.warn("⚠️ Цена закрытия не получена, пропускаем");
      return;
    }
    await upsertTodayEntry({ close: closePrice });
  } catch (err) {
    console.error("❌ Ошибка в saveClose:", err);
  }
}

export function startDailyTasks() {
  cron.schedule("30 16 * * *", saveOpenAndMacro, { timezone: "Europe/Moscow" });
  cron.schedule("0 23 * * *", saveClose, { timezone: "Europe/Moscow" });
  console.log("⏳ Планировщик запущен: open в 16:30, close в 23:00 (МСК)");
}
