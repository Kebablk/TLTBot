<<<<<<< HEAD
// принимает решение
=======
// src/core/strategy.js
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();
const API_KEY = "YIBWWGPQLKAAZGBZ";
const FRED_API_KEY = "c6b3e6442d500c408624f67d2fe73369";

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

    return {
      price,
      lastDividend: last?.amount || "нет данных",
      lastExDate: last?.ex_dividend_date || "нет данных",
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
>>>>>>> 4e6f1954f0cc47d2ac4ababcb89b5cd8c8cd656f
