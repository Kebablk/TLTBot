import prisma from "../lib/prismaClient.js";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function calculateAnnualPeak(closeTLT) {
  const yearlyHigh = await prisma.dailyData.aggregate({
    where: {
      date: {
        gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
          .toISOString()
          .split("T")[0],
      },
    },
    _max: {
      close: true,
    },
  });

  const yearlyMax = yearlyHigh._max.close || null;
  console.log("yearlyMax: ", yearlyMax);

  return ((yearlyMax - closeTLT) / yearlyMax) * 100;
}

export async function isHistoricalLowAnchorTriggered(closeTLT) {
  const historicalLow = await prisma.dailyData.aggregate({
    where: {
      date: {
        gte: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      },
    },
    _min: {
      close: true,
    },
  });

  const previousBottom = historicalLow._min.close;
  console.log("previousBottom: ", previousBottom);

  if (!previousBottom || previousBottom === 0) return false;
  return closeTLT <= previousBottom * 1.02;
}

async function getTLTVolume() {
  try {
    const quote = await yahooFinance.quote("TLT");
    const volume = quote.regularMarketVolume;
    const avgVolume = quote.averageDailyVolume3Month;
    return { volume, avgVolume };
  } catch (error) {
    console.error("Ошибка получения объема TLT: ", error);
    return null;
  }
}

export async function calculateVolumetricPanic(openTLT, closeTLT) {
  const volumeData = await getTLTVolume();
  if (!volumeData) {
    console.warn("Не удалось получить данные по объему");
    return false;
  }

  const { volume, avgVolume } = volumeData;
  if (!avgVolume || avgVolume === 0) {
    console.warn("Средний объем равен 0 или отсутствует");
    return false;
  }

  console.log(`volumetricPanic: ${volume}, ${avgVolume}`);

  return volume > avgVolume * 2 && ((openTLT - closeTLT) / openTLT) * 100 > 2;
}
