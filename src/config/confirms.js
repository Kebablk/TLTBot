import YahooFinance from "yahoo-finance2";
import prisma from "../lib/prismaClient.js";
import { RSI } from "technicalindicators";

const yahooFinance = new YahooFinance();

export async function calculateAnnualMinimumConf(closeTLT) {
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  const yearlyMin = await prisma.dailyData.aggregate({
    where: {
      date: {
        gte: oneYearAgo.toISOString().split("T")[0],
      },
    },
    _min: {
      close: true,
    },
  });

  const minPrice = yearlyMin._min.close || null;
  if (!minPrice || minPrice === 0) {
    console.warn("Нет данных для расчёта годового минимума");
    return false;
  }

  return closeTLT <= minPrice * 1.02;
}

export async function checkRSIConf() {
  try {
    const dbRecords = await prisma.dailyData.findMany({
      where: {
        close: { not: null },
      },
      orderBy: { date: "desc" },
      take: 14,
      select: { close: true },
    });

    let closes = dbRecords
      .map((record) => record.close)
      .filter((close) => close !== null);

    if (closes.length < 14) {
      console.log(
        `В БД только ${closes.length} дней для RSI, запрашиваю из Yahoo Finance...`,
      );

      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - 60);

      const result = await yahooFinance.historical("TLT", {
        period1: startDate,
        period2: today,
        interval: "1d",
      });

      closes = result
        .filter((item) => item.close !== null && item.adjclose !== null)
        .map((item) => item.close);

      if (closes.length < 14) {
        console.warn(`❌ Недостаточно данных для RSI: ${closes.length} дней`);
        return false;
      }

      closes = closes.slice(-14);
      console.log(`Получено ${closes.length} дней из Yahoo Finance`);
    } else {
      closes.reverse();
      console.log(`Получено ${closes.length} дней из БД`);
    }

    const RSIValues = RSI.calculate({
      values: closes,
      period: 14,
    });
    const RSI14 = RSIValues[RSIValues.length - 1];

    console.log(`Текущий RSI (14): ${RSI14}`);
    return RSI14 < 30;
  } catch (error) {
    console.error("Ошибка в checkRSIConf: ", error);
    return false;
  }
}

export function checkRealYieldConf(realYield) {
  return realYield > 0;
}

async function determineFedTrend() {
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setDate(today.getDate() - 365);

  let rates = await prisma.dailyData.findMany({
    where: {
      date: {
        gte: oneYearAgo.toISOString().split("T")[0],
      },
      fedRate: { not: null },
    },
    orderBy: { date: "asc" },
    select: { fedRate: true },
  });

  let fedRates = rates
    .map((rate) => rate.fedRate)
    .filter((rate) => rate !== null && !isNaN(rate));

  if (fedRates.length < 2) {
    console.log(
      `В БД только ${fedRates.length} записей для тренда, запрашиваю из FRED...`,
    );

    const FRED_API_KEY = process.env.FRED_API_KEY;
    if (!FRED_API_KEY) {
      console.warn("❌ FRED_API_KEY не задан, возвращаю 'stable'");
      return "stable";
    }

    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DFEDTARU&api_key=${FRED_API_KEY}&file_type=json&observation_start=${oneYearAgo.toISOString().split("T")[0]}&sort_order=asc`;

    const res = await fetch(url);
    const data = await res.json();

    fedRates = data.observations
      .filter((o) => o.value !== "." && o.value !== null)
      .map((o) => parseFloat(o.value))
      .filter((r) => !isNaN(r));

    if (fedRates.length < 2) {
      console.warn(
        `❌ Недостаточно данных для тренда: ${fedRates.length} записей`,
      );
      return "stable";
    }

    console.log(`Получено ${fedRates.length} записей из FRED`);
  } else console.log(`Получено ${fedRates.length} записей из БД`);

  const first = fedRates[0];
  const last = fedRates[fedRates.length - 1];
  const diff = last - first;
  const threshold = 0.05;

  let trend = "stable";
  if (diff > threshold) trend = "rising";
  if (diff < -threshold) trend = "falling";

  console.log(`Тренд ставки ФРС: ${trend} (diff: ${diff})`);
  return trend;
}

export async function checkFedRateConf(fedRate) {
  const fedTrend = await determineFedTrend();
  console.log("fedTrend: ", fedTrend);

  return fedRate > 4.0 && fedTrend !== "rising";
}

export async function checkMA50Conf(closeTLT) {
  try {
    const records = await prisma.dailyData.findMany({
      where: {
        close: { not: null },
      },
      orderBy: { date: "desc" },
      take: 50,
      select: { close: true },
    });

    const closes = records.map((record) => record.close);
    if (closes.length < 50) {
      console.warn(`Недостаточно данных в БД: ${closes.length} дней`);
      return false;
    }

    const MA50 = closes.reduce((a, b) => a + b, 0) / closes.length;
    console.log("MA50: ", MA50);

    return closeTLT < MA50;
  } catch (error) {
    console.error("Ошибка рассчета MA50: ", error);
    return false;
  }
}
