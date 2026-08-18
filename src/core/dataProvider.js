import cron from "node-cron";
import dotenv from "dotenv";
import { getAllHistory, getTLTData } from "../replies/repliesStrategy.js";
import prisma from "../lib/prismaClient.js";
import { calculateYields } from "../config/settings.js";
import YahooFinance from "yahoo-finance2";
import {
  calculateAnnualPeak,
  calculateVolumetricPanic,
  isHistoricalLowAnchorTriggered,
} from "../config/anchors.js";
import { convertionConfsAndAnchsToObj } from "../config/combinations.js";

dotenv.config();
const yahooFinance = new YahooFinance();

async function getOpenPrice() {
  try {
    const quote = await yahooFinance.quote("TLT");
    return quote.regularMarketOpen || null;
  } catch (err) {
    console.warn("Ошибка получения open:", err.message);
    return null;
  }
}

async function getClosePrice() {
  try {
    const quote = await yahooFinance.quote("TLT");
    return quote.regularMarketPrice || null;
  } catch (err) {
    console.warn("Ошибка получения close:", err.message);
    return null;
  }
}

async function fetchPriceWithRetry(fetchFn, maxAttempts = 30, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const price = await fetchFn();
      if (price !== null && price !== 0) {
        console.log("Price найден в fetch: ", price);
        return price;
      }
    } catch (err) {
      console.warn(`⚠️ Ошибка (попытка ${attempt}):`, err.message);
    }
    if (attempt < maxAttempts) {
      console.log(`⏳ Попытка ${attempt + 1} через ${delayMs}мс...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  console.warn(`❌ Не удалось получить цену за ${maxAttempts} попыток`);
  return null;
}

async function saveOpen() {
  try {
    const data = await getTLTData();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const dayOfWeek = now.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(
        `⏳ Сегодня выходной (${dayOfWeek === 0 ? "воскресенье" : "суббота"}), задача пропущена`,
      );
      return;
    }

    await prisma.dailyData.upsert({
      where: { date: today },
      update: {
        close: null,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: data.lastDividend,
      },
      create: {
        date: today,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: data.lastDividend,
        open: null,
        close: null,
      },
    });
    console.log(`Запись за ${today} создана/обновлена (без open)`);

    (async () => {
      await new Promise((resolve) => setTimeout(resolve, 300000));
      const openPrice = await fetchPriceWithRetry(getOpenPrice, 10, 10000);
      if (openPrice !== null) {
        await prisma.dailyData.update({
          where: { date: today },
          data: { open: openPrice },
        });
        console.log(`open дозаписан: ${openPrice}`);
      } else {
        console.warn(`open не получен, запись осталась без open`);
      }
    })();
  } catch (error) {
    console.error("Ошибка в saveOpenAndMacro:", error);
  }
}

async function saveClose() {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(
        `⏳ Сегодня выходной (${dayOfWeek === 0 ? "воскресенье" : "суббота"}), задача пропущена`,
      );
      return;
    }

    const closePrice = await fetchPriceWithRetry(getClosePrice, 120, 5000);
    if (closePrice === null) {
      console.warn("❌ Цена close не получена, запись пропущена");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const existing = await prisma.dailyData.findUnique({
      where: { date: today },
      select: { open: true, dividend: true, inflation: true },
    });

    const dividend = existing?.dividend ?? null;
    const inflation = existing?.inflation ?? null;
    const { nominalYield, realYield } = calculateYields(
      closePrice,
      dividend,
      inflation,
    );

    await prisma.dailyData.upsert({
      where: { date: today },
      update: {
        close: closePrice,
        nominalYield: nominalYield,
        realYield: realYield,
        yearlyMax: ACData.anchors[0],
      },
      create: {
        date: today,
        close: closePrice,
        nominalYield: nominalYield,
        realYield: realYield,
        yearlyMax: ACData.anchors[0],
      },
    });

    const ACData = await convertionConfsAndAnchsToObj();
    console.log("ACData: ", ACData);

    console.log(`Запись за ${today} обновлена (close)`);
  } catch (error) {
    console.error("Ошибка в saveClose:", error);
  }
}

export function startDailyTasks() {
  cron.schedule("42 16 * * *", saveOpen, { timezone: "Europe/Moscow" });
  cron.schedule("30 23 * * *", saveClose, { timezone: "Europe/Moscow" });
  console.log("⏳ Планировщик запущен: open в 16:30 МСК, close в 23:00 МСК");
}

export async function setTwoYearsData() {
  try {
    const data = await getAllHistory();
    const today = new Date().toISOString().split("T")[0];
    const filteredData = data.filter((item) => item.date <= today);
    const createdRecords = [];

    for (let i = 0; i < filteredData.length; i++) {
      const dataForTwoYears = await prisma.dailyData.upsert({
        where: { date: filteredData[i].date },
        update: {
          open: filteredData[i].open,
          close: filteredData[i].close,
          fedRate: filteredData[i].fedRate,
          inflation: filteredData[i].inflation,
          dividend: filteredData[i].dividend,
          nominalYield: filteredData[i].nominalYield ?? null,
          realYield: filteredData[i].realYield ?? null,
        },
        create: {
          date: filteredData[i].date,
          open: filteredData[i].open,
          close: filteredData[i].close,
          fedRate: filteredData[i].fedRate,
          inflation: filteredData[i].inflation,
          dividend: filteredData[i].dividend,
          nominalYield: filteredData[i].nominalYield ?? null,
          realYield: filteredData[i].realYield ?? null,
        },
      });

      createdRecords.push(dataForTwoYears);
    }
    console.log(`✅ Создано/обновлено ${createdRecords.length} записей`);
    return createdRecords;
  } catch (error) {
    console.error("❌ Ошибка в setTwoYearsData:", error);
    throw error;
  }
}
