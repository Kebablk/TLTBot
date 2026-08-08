import cron from "node-cron";
import dotenv from "dotenv";
import { getTLTData } from "../replies/repliesStrategy.js";
import prisma from "../lib/prismaClient.js";
import { getFirstData } from "../config/settings.js";

dotenv.config();

export async function saveOpen() {
  try {
    const data = await getTLTData();
    if (!data.price || data.price === 0) {
      console.warn("Цена не получена, скипаем");
      return;
    }

    const yields = await getFirstData();
    console.log(yields);

    const today = new Date().toISOString().split("T")[0];

    await prisma.dailyData.upsert({
      where: { date: today },
      update: {
        open: data.price,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: parseFloat(data.lastDividend) || null,
        nominalYield: yields.nominalYield,
        realYield: yields.realYield,
      },
      create: {
        date: today,
        open: data.price,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: parseFloat(data.lastDividend) || null,
        nominalYield: yields.nominalYield,
        realYield: yields.realYield,
      },
    });

    console.log(`✅ Запись за ${today} обновлена (open, макро)`);
  } catch (error) {
    console.error("❌ Ошибка в saveOpenAndMacro:", error);
  }
}

export async function saveClose() {
  try {
    const data = await getTLTData();
    if (!data.price || data.price === 0) {
      console.warn("Цена не получена, скипаем");
      return;
    }

    const yields = await getFirstData();
    console.log(yields);

    const today = new Date().toISOString().split("T")[0];

    await prisma.dailyData.upsert({
      where: { date: today },
      update: {
        close: data.price,
        nominalYield: yields.nominalYield,
        realYield: yields.realYield,
      },
      create: {
        date: today,
        close: data.price,
        nominalYield: yields.nominalYield,
        realYield: yields.realYield,
      },
    });

    console.log(`✅ Запись за ${today} обновлена (close)`);
  } catch (error) {
    console.error("❌ Ошибка в saveClose:", error);
  }
}

export function startDailyTasks() {
  cron.schedule("30 21 * * *", saveOpen);
  cron.schedule("0 20 * * *", saveClose);
  console.log(
    "⏳ Планировщик запущен: open в 17:43 UTC (20:43 МСК), close в 20:00 UTC (23:00 МСК)",
  );
}
