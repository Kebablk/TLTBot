import cron from "node-cron";
import dotenv from "dotenv";
import { getAllHistory, getTLTData } from "../replies/repliesStrategy.js";
import prisma from "../lib/prismaClient.js";
import { calculateYields } from "../config/settings.js";

dotenv.config();

async function fetchPriceWithRetry(maxAttempts = 30, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await getTLTData();
      if (data.price && data.price !== 0) {
        return data.price;
      }
    } catch (err) {
      console.warn(
        `⚠️ Ошибка получения цены (попытка ${attempt}):`,
        err.message,
      );
    }
    console.log(
      `⏳ Цена не получена, попытка ${attempt + 1} через ${delayMs}мс...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  console.warn(`❌ Цена не получена за ${maxAttempts} попыток`);
  return null;
}

export async function saveOpen() {
  try {
    const data = await getTLTData();
    const today = new Date().toISOString().split("T")[0];

    await prisma.dailyData.upsert({
      where: { date: today },
      update: {
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
      },
    });
    console.log(`Запись за ${today} создана/обновлена (без open)`);

    (async () => {
      const openPrice = await fetchOpenWithRetry(60, 5000);
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

export async function saveClose() {
  try {
    const closePrice = await fetchPriceWithRetry(30, 5000);
    if (closePrice === null) {
      console.warn("❌ Цена close не получена, запись пропущена");
      return;
    }
  
    const today = new Date().toISOString().split("T")[0];

    const existing = await prisma.dailyData.findUnique({
      where: { date: today },
      select: { dividend: true, inflation: true },
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
      },
      create: {
        date: today,
        close: closePrice,
        nominalYield: nominalYield,
        realYield: realYield,
      },
    });

    console.log(`Запись за ${today} обновлена (close)`);
  } catch (error) {
    console.error("Ошибка в saveClose:", error);
  }
}

export function startDailyTasks() {
  cron.schedule("34 19 * * *", saveOpen, { timezone: "Europe/Moscow" });
  cron.schedule("35 19 * * *", saveClose, { timezone: "Europe/Moscow" });
  console.log("⏳ Планировщик запущен: open в 16:30 МСК, close в 23:00 МСК");
}

export async function setTwoYearsData() {
  try {
    const data = await getAllHistory();
    const createdRecords = [];

    for (let i = 0; i < data.length; i++) {
      const dataForTwoYears = await prisma.dailyData.upsert({
        where: { date: data[i].date },
        update: {
          open: data[i].open,
          close: data[i].close,
          fedRate: data[i].fedRate,
          inflation: data[i].inflation,
          dividend: data[i].dividend,
          nominalYield: data[i].nominalYield ?? null,
          realYield: data[i].realYield ?? null,
        },
        create: {
          date: data[i].date,
          open: data[i].open,
          close: data[i].close,
          fedRate: data[i].fedRate,
          inflation: data[i].inflation,
          dividend: data[i].dividend,
          nominalYield: data[i].nominalYield ?? null,
          realYield: data[i].realYield ?? null,
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