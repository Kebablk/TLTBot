// src/core/dataProvider.js
import YahooFinance from "yahoo-finance2";
import fs from "fs/promises";
import path from "path";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

// === Конфигурация ===
const FRED_API_KEY = process.env.FRED_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FED_FUNDS_RATE_SERIES = "DFEDTARU"; // эффективная ставка
const CPI_SERIES = "CPIAUCSL"; // индекс потребительских цен

// Путь к файлу данных (папка data в корне проекта)
const DATA_FILE = path.resolve(process.cwd(), "data", "data.json");

const yahooFinance = new YahooFinance();

// === Вспомогательная функция: получить цену TLT (open или close) ===
async function getTLTPrice(type = "open") {
  // type: "open" или "close"
  try {
    // Пытаемся получить свечу за сегодня через chart
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

  // Fallback: через quote (текущая цена)
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

  // Второй fallback: Alpha Vantage (если есть ключ)
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

// === Получение макропараметров (ставка ФРС, инфляция, дивиденд) ===
async function fetchMacroData() {
  let fedRate = null;
  let inflation = null;
  let dividend = null;

  try {
    // Ставка ФРС
    if (FRED_API_KEY) {
      const fedRes = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${FED_FUNDS_RATE_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`,
      );
      const fedData = await fedRes.json();
      const latest = fedData.observations?.[0];
      if (latest && latest.value && latest.value !== ".") {
        fedRate = parseFloat(latest.value);
      }
    }

    // Инфляция (годовой прирост CPI)
    if (FRED_API_KEY) {
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

    // Дивиденд (годовой) – через Yahoo Finance
    const summary = await yahooFinance.quoteSummary("TLT", {
      modules: ["summaryDetail"],
    });
    const dividendRate = summary?.summaryDetail?.trailingAnnualDividendRate;
    if (dividendRate) {
      dividend = parseFloat(dividendRate);
    }
  } catch (err) {
    console.error("Ошибка получения макроданных:", err);
  }

  return { fedRate, inflation, dividend };
}

// === Загрузка всех записей из data.json ===
async function loadData() {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// === Сохранение всего массива ===
async function saveData(data) {
  // Убедимся, что папка data существует
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// === Добавление / обновление записи за сегодня ===
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

// === Задача в 20:10 – записать open и макропараметры ===
async function saveOpenAndMacro() {
  console.log("⏰ 20:10 – запись open и макроданных");
  try {
    const openPrice = await getTLTPrice("open");
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

// === Задача в 23:00 – записать close ===
async function saveClose() {
  console.log("⏰ 23:00 – запись close");
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
  // Задача на 20:10 (open + макро)
  cron.schedule("15 21 * * *", saveOpenAndMacro, { timezone: "Europe/Moscow" });
  // Задача на 23:00 (close)
  cron.schedule("0 23 * * *", saveClose, { timezone: "Europe/Moscow" });
  console.log(
    "⏳ Планировщик запущен: сохранение open в 20:10, close в 23:00 (МСК)",
  );
}

// === Экспорт функций для ручного тестирования ===
export { saveOpenAndMacro, saveClose };
