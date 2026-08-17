import YahooFinance from "yahoo-finance2";
import prisma from "../lib/prismaClient";
import { rsi } from "financial-toolkit";

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
    const today = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(today.getDate() - 14);

    const result = await yahooFinance.historical("TLT", {
      period1: fourteenDaysAgo,
      period2: today,
      interval: "1d",
    });

    if (result.length < 14) {
      console.warn(`Недостаточно данных для RSI: ${result.length} дней`);
      return false;
    }

    const closes = result.map((item) => item.close);
    console.log("Closes за 14 дней: ", closes);

    const RSIValues = rsi(closes, 14);
    const RSI14 = RSIValues[RSIValues.length - 1];

    console.log(`Текущий RSI (14): ${RSI14.toFixed(2)}`);
    return RSI14 < 30;
  } catch (error) {
    console.error("Ошибка получения исторических данных: ", error);
    return false;
  }
}

export function checkRealYieldConf(realYield) {
  return realYield > 0;
}

async function determineFedTrend() {
  const oneYearAgo = new Date();
  oneYearAgo.setDate(today.getDate() - 365);

  const [first, last] = await Promise.all([
    prisma.dailyData.findFirst({
      where: {
        date: {
          gte: oneYearAgo.toISOString().split("T")[0],
        },
      },
      orderBy: { date: "asc" },
      select: { fedRate: true },
    }),
    prisma.dailyData.findFirst({
      where: {
        date: {
          gte: oneYearAgo.toISOString().split("T")[0],
        },
      },
      orderBy: { date: "desc" },
      select: { fedRate: true },
    }),
  ]);

  if (!first || !last || first.fedRate === null || last.fedRate === null) {
    console.warn("Недостаточно данных для определения тренда");
    return "stable";
  }

  const diff = (last.fedRate = first.fedRate);
  const threshold = 0.05;

  if (diff > threshold) return "rising";
  if (diff < -threshold) return "falling";
  return "stable";
}

export async function checkFedRateConf(fedRate) {
  const fedTrend = await determineFedTrend();
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

    return closeTLT < MA50;
  } catch (error) {
    console.error("Ошибка рассчета MA50: ", error);
    return false;
  }
}
