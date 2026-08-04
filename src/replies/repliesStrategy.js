// src/core/strategy.js (или repliesStrategy.js)
import YahooFinance from "yahoo-finance2";
import dotenv from "dotenv";
dotenv.config();

const yahooFinance = new YahooFinance();

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FRED_API_KEY = process.env.FRED_API_KEY;
const FED_FUNDS_RATE_SERIES = "DFEDTARU";
const CPI_SERIES = "CPIAUCSL";

// === Вспомогательная функция: получить цену TLT с несколькими попытками ===
async function getTLTPrice() {
  // 1. Пробуем Yahoo Finance (самый стабильный, не требует ключа)
  try {
    const quote = await yahooFinance.quote("TLT");
    if (quote?.regularMarketPrice) {
      return quote.regularMarketPrice;
    }
  } catch (e) {
    console.warn("Yahoo Finance quote не сработал, пробуем Alpha Vantage");
  }

  // 2. Пробуем Alpha Vantage (если есть ключ)
  if (API_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TLT&apikey=${API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const price = parseFloat(json["Global Quote"]?.["05. price"]);
      if (price) return price;
    } catch (e) {
      console.warn("Alpha Vantage не дал цену");
    }
  }

  // 3. Самый крайний случай — берём вчерашнее закрытие через chart
  try {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 2); // запас на случай выходных
    const chart = await yahooFinance.chart("TLT", {
      period1: start,
      interval: "1d",
    });
    const candles = chart?.quotes || [];
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      if (lastCandle?.close) {
        return lastCandle.close;
      }
    }
  } catch (e) {
    console.warn("Не удалось получить цену даже через chart");
  }

  return null; // совсем ничего не вышло
}

// === Основная функция ===
export async function getTLTData() {
  try {
    const price = await getTLTPrice();

    // Дивиденды (оставляем как есть)
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

    const last = history.length > 0 ? history[0] : null;

    // Макро (ставка, инфляция)
    let fedRate = null;
    try {
      const fedRes = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${FED_FUNDS_RATE_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`,
      );
      const fedData = await fedRes.json();
      const latest = fedData.observations?.[0];
      if (latest && latest.value && latest.value !== ".") {
        fedRate = parseFloat(latest.value);
      }
    } catch (e) {
      console.error("Ошибка получения ставки ФРС:", e);
    }

    let inflationRate = null;
    try {
      const cpiUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${CPI_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=13`;
      const cpiRes = await fetch(cpiUrl);
      const cpiData = await cpiRes.json();
      const observations = cpiData.observations || [];
      if (observations.length >= 2) {
        const current = parseFloat(observations[0].value);
        const yearAgo = parseFloat(
          observations[12]?.value ||
            observations[observations.length - 1].value,
        );
        if (current && yearAgo) {
          inflationRate = ((current - yearAgo) / yearAgo) * 100;
        }
      }
    } catch (e) {
      console.error("Ошибка получения инфляции:", e);
    }

    return {
      price: price ?? 0, // если null → 0
      lastDividend: last?.amount || "нет данных",
      lastExDate: last?.ex_dividend_date || "нет данных",
      fedRate,
      inflationRate,
    };
  } catch (error) {
    console.error("Ошибка в getTLTData:", error);
    return {
      price: 0,
      lastDividend: "нет данных",
      lastExDate: "нет данных",
      fedRate: null,
      inflationRate: null,
    };
  }
}
