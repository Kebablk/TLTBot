// принимает решение
import YahooFinance from "yahoo-finance2";
import dotenv from "dotenv";
dotenv.config();

const yahooFinance = new YahooFinance();

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

const FRED_API_KEY = process.env.FRED_API_KEY;
const FED_FUNDS_RATE_SERIES = "DFEDTARU";
const CPI_SERIES = "CPIAUCSL";

export async function getTLTData() {
  try {
    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TLT&apikey=${API_KEY}`;
    const quoteRes = await fetch(quoteUrl);
    const quote = await quoteRes.json();
    const price = parseFloat(quote["Global Quote"]?.["05. price"]) || 0;

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
    const last12 = history.slice(0, 12);
    const annualDividend = last12.reduce(
      (sum, d) => sum + parseFloat(d.amount),
      0,
    );

    let fedRate = null;
    try {
      const fedResponse = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${FED_FUNDS_RATE_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`,
      );
      const fedData = await fedResponse.json();
      const latest = fedData.observations?.[0];
      if (latest && latest.value && latest.value !== ".") {
        fedRate = parseFloat(latest.value);
      }
    } catch (fedError) {
      console.error(fedError);
    }

    let inflationRate = null;
    try {
      // Получаем последние 13 наблюдений (чтобы вычислить изменение за год)
      const cpiUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${CPI_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=13`;
      const cpiResponse = await fetch(cpiUrl);
      const cpiData = await cpiResponse.json();
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
    } catch (cpiError) {
      console.error("Ошибка получения инфляции:", cpiError);
    }

    return {
      price,
      lastDividend: last?.amount || "нет данных",
      lastExDate: last?.ex_dividend_date || "нет данных",
      fedRate,
      inflationRate,
    };
  } catch (error) {
    console.error("Ошибка в getTLTData:", error);
    return {
      price: 0,
      dividendYield: "0.0",
      dividendPerShare: "0.0",
      lastDividend: "нет данных",
      lastExDate: "нет данных",
      history: [],
    };
  }
}
