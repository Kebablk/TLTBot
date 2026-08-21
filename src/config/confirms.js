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
      .filter((close) => close !== null)
      .reverse();

    let growthAmount = 0;
    let fallAmount = 0;
    for (let i = 0; i < closes.length - 1; i++) {
      if (closes[i + 1] - closes[i] >= 0)
        growthAmount += closes[i + 1] - closes[i];
      else fallAmount += Math.abs(closes[i + 1] - closes[i]);
    }

    const averageHeight = growthAmount / closes.length - 1;
    const averageDrop = fallAmount / closes.length - 1;
    if (averageDrop === 0) return 100;

    const RS = averageHeight / averageDrop;
    const RSI14 = 100 - 100 / (1 + RS);

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

  if (fedRates.length < 5) {
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

    if (fedRates.length < 5) {
      console.warn(
        `❌ Недостаточно данных для тренда: ${fedRates.length} записей`,
      );
      return "stable";
    }

    console.log(`Получено ${fedRates.length} записей из FRED`);
  } else {
    console.log(`Получено ${fedRates.length} записей из БД`);
  }

  const n = fedRates.length;
  const indices = fedRates.map((_, i) => i);

  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = fedRates.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((a, b, i) => a + b * fedRates[i], 0);
  const sumX2 = indices.reduce((a, b) => a + b * b, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  const threshold = 0.005;
  let trend = "stable";
  if (slope > threshold) trend = "rising";
  if (slope < -threshold) trend = "falling";

  console.log(`Тренд ставки ФРС: ${trend} (slope: ${slope})`);
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
