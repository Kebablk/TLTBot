import YahooFinance from "yahoo-finance2";
import dotenv from "dotenv";
dotenv.config();

const yahooFinance = new YahooFinance();

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const FRED_API_KEY = process.env.FRED_API_KEY;
const FED_FUNDS_RATE_SERIES = "DFEDTARU";
const CPI_SERIES = "CPIAUCSL";

async function getTLTPrice() {
  try {
    const quote = await yahooFinance.quote("TLT");
    if (quote?.regularMarketPrice) {
      return quote.regularMarketPrice;
    }
  } catch (e) {
    console.warn("Yahoo Finance quote не сработал, пробуем Alpha Vantage");
  }

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

  try {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 2);
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

  return null;
}

export async function getTLTData() {
  try {
    const price = await getTLTPrice();

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
      price: price ?? 0,
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

async function getTLTHistory() {
  const now = new Date();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const result = await yahooFinance.historical("TLT", {
    period1: twoYearsAgo,
    period2: now,
    interval: "1d",
  });

  return result.map((item) => ({
    date: item.date.toISOString().split("T")[0],
    open: item.open,
    close: item.close,
  }));
}

async function getTLTDividends() {
  const now = new Date();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const result = await yahooFinance.historical("TLT", {
    period1: twoYearsAgo,
    period2: now,
    interval: "1d",
    events: "dividends",
  });

  return result.map((item) => ({
    date: item.date.toISOString().split("T")[0],
    dividend: item.dividend,
  }));
}

async function getFedRateHistory() {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const startDate = twoYearsAgo.toISOString().split("T")[0];

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&sort_order=asc`;

  const res = await fetch(url);
  const data = await res.json();
  return data.observations.map((item) => ({
    date: item.date,
    fedRate: parseFloat(item.value),
  }));
}

async function getInflationHistory() {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const startDate = twoYearsAgo.toISOString().split("T")[0];

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&sort_order=asc`;

  const res = await fetch(url);
  const data = await res.json();
  return data.observations.map((item) => ({
    date: item.date,
    cpi: parseFloat(item.value),
  }));
}

export async function getAllHistory() {
  const [prices, dividends, fedRates, cpiData] = await Promise.all([
    getTLTHistory(),
    getTLTDividends(),
    getFedRateHistory(),
    getInflationHistory(),
  ]);

  const fedMap = Object.fromEntries(fedRates.map((d) => [d.date, d.fedRate]));
  const cpiMap = Object.fromEntries(cpiData.map((d) => [d.date, d.cpi]));
  const divMap = Object.fromEntries(dividends.map((d) => [d.date, d.dividend]));

  return prices.map((price) => ({
    date: price.date,
    open: price.open,
    close: price.close,
    dividend: divMap[price.date] || null,
    fedRate: fedMap[price.date] || null,
    cpi: cpiMap[price.date] || null,
  }));
}
