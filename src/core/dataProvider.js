// src/core/dataProvider.js
import YahooFinance from "yahoo-finance2";
import fs from "fs/promises";
import path from "path";
import cron from "node-cron";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

// === Определяем путь к файлу данных ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// На Render используем корневую папку /data (если подключен диск), иначе локальная папка data
const isRender = process.env.RENDER === "true";
const DATA_DIR = isRender ? "/data" : path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

console.log("📁 DATA_FILE path:", DATA_FILE);

// === Конфигурация ===
const FRED_API_KEY = process.env.FRED_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FED_FUNDS_RATE_SERIES = "DFEDTARU"; // целевая ставка (верхняя граница)
const CPI_SERIES = "CPIAUCSL";

const yahooFinance = new YahooFinance();

// === Задержка (чтобы избежать 429 Too Many Requests) ===
function delay(ms = 2000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// === Вспомогательная функция: получить цену TLT (open или close) ===
async function getTLTPrice(type = "open") {
  try {
    const today = new Date().toISOString().split("T")[0];
    const start = new Date(today);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const chartResult = await yahooFinance.chart("TLT", {
      period1: start,
      period2: end,
      interval: "1d",
    });

    const candle = chartResult?.quotes?.[0];
    if (candle) {
      if (type === "open" && candle.open) return candle.open;
      if (type === "close" && candle.close) return candle.close;
    }
  } catch (e) {
    console.warn(`Yahoo chart для ${type} не сработал, пробуем quote`);
  }

  // Fallback через quote
  try {
    const quote = await yahooFinance.quote("TLT");
    if (type === "open" && quote.regularMarketOpen) {
      return quote.regularMarketOpen;
    }
    if (type === "close" && quote.regularMarketPrice) {
      return quote.regularMarketPrice;
    }
  } catch (e) {
    console.warn(`Yahoo quote для ${type} не сработал`);
  }

  // Fallback через Alpha Vantage
  if (ALPHA_VANTAGE_API_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TLT&apikey=${ALPHA_VANTAGE_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const price = parseFloat(json["Global Quote"]?.["05. price"]);
      if (price) return price;
    } catch (e) {
      console.warn("Alpha Vantage не дал цену");
    }
  }

  return null;
}

// === Получение макропараметров (ставка ФРС, инфляция) из FRED ===
async function fetchMacroData() {
  let fedRate = null;
  let inflation = null;

  try {
    if (FRED_API_KEY) {
      // Ставка ФРС
      const fedRes = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${FED_FUNDS_RATE_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`,
      );
      const fedData = await fedRes.json();
      const latest = fedData.observations?.[0];
      if (latest && latest.value && latest.value !== ".") {
        fedRate = parseFloat(latest.value);
      }

      // Инфляция (CPI)
      const cpiRes = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${CPI_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=13`,
      );
      const cpiData = await cpiRes.json();
      const observations = cpiData.observations || [];
      if (observations.length >= 2) {
        const current = parseFloat(observations[0].value);
        const yearAgo = parseFloat(
          observations[12]?.value ||
            observations[observations.length - 1].value,
        );
        if (current && yearAgo) {
          inflation = ((current - yearAgo) / yearAgo) * 100;
        }
      }
    }
  } catch (err) {
    console.error("Ошибка получения макроданных из FRED:", err);
  }

  return { fedRate, inflation };
}

// === Получение последнего дивиденда с кэшированием (чтобы не дёргать Yahoo часто) ===
let cachedDividend = null;
let lastDividendFetchTime = 0;
const CACHE_TTL = 3600000; // 1 час

async function fetchLastDividend() {
  const now = Date.now();
  if (cachedDividend && now - lastDividendFetchTime < CACHE_TTL) {
    console.log("📦 Использую кэшированный дивиденд");
    return cachedDividend;
  }

  try {
    // Задержка, чтобы избежать 429
    await delay(2000);
    const chartResult = await yahooFinance.chart("TLT", {
      period1: "2024-01-01",
      period2: new Date().toISOString().split("T")[0],
      interval: "1d",
    });
    const dividends = chartResult?.events?.dividends || [];
    const history = dividends
      .filter((item) => item.amount && item.amount > 0)
      .map((item) => ({
        ex_dividend_date:
          item.date instanceof Date
            ? item.date.toISOString().slice(0, 10)
            : item.date,
        amount: item.amount.toFixed(5),
      }))
      .sort(
        (a, b) => new Date(b.ex_dividend_date) - new Date(a.ex_dividend_date),
      );

    cachedDividend = history.length > 0 ? history[0] : null;
    lastDividendFetchTime = now;
    console.log("🔄 Кэш дивидендов обновлён");
    return cachedDividend;
  } catch (err) {
    console.error("Ошибка получения дивидендов:", err);
    // Возвращаем старый кэш, если есть
    return cachedDividend;
  }
}

// === Работа с файлом ===
async function loadData() {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.log("📄 Файл данных не найден или пуст, создаём новый массив");
    return [];
  }
}

async function saveData(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`💾 Данные сохранены в ${DATA_FILE}`);
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

// === Задача в 20:43 – записать open и макропараметры ===
async function saveOpenAndMacro() {
  console.log(
    `⏰ 20:43 – запись open и макроданных (${new Date().toISOString()})`,
  );
  try {
    const openPrice = await getTLTPrice("open");
    if (!openPrice) {
      console.warn("⚠️ Цена открытия не получена, пропускаем");
      return;
    }

    const macro = await fetchMacroData();
    const lastDividend = await fetchLastDividend();

    await upsertTodayEntry({
      open: openPrice,
      fedRate: macro.fedRate,
      inflation: macro.inflation,
      dividend: lastDividend ? parseFloat(lastDividend.amount) : null,
    });
  } catch (err) {
    console.error("❌ Ошибка в saveOpenAndMacro:", err);
  }
}

// === Задача в 23:00 – записать close ===
async function saveClose() {
  console.log(`⏰ 23:00 – запись close (${new Date().toISOString()})`);
  try {
    const closePrice = await getTLTPrice("close");
    if (!closePrice) {
      console.warn("⚠️ Цена закрытия не получена, пропускаем");
      return;
    }
    await upsertTodayEntry({ close: closePrice });
  } catch (err) {
    console.error("❌ Ошибка в saveClose:", err);
  }
}

// === Экспорт функции запуска планировщика ===
export function startDailyTasks() {
  // Время указано в UTC: 17:43 UTC = 20:43 МСК, 20:00 UTC = 23:00 МСК
  cron.schedule("40 18 * * *", saveOpenAndMacro);
  cron.schedule("0 20 * * *", saveClose);
  console.log(
    "⏳ Планировщик запущен: open в 17:43 UTC (20:43 МСК), close в 20:00 UTC (23:00 МСК)",
  );
}

// Экспортируем для ручных тестов
export { saveOpenAndMacro, saveClose };
