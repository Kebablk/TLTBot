import cron from "node-cron";
import dotenv from "dotenv";
import { getTLTData } from "../replies/repliesStrategy.js";
import prismaClient from "../lib/prismaClient.js";

dotenv.config();

export async function saveOpen() {
  try {
    const data = await getTLTData();
    if (!data.price || data.price === 0) {
      console.warn("Цена не получена, скипаем");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    await prismaClient.dailyData.upsert({
      where: { date: today },
      update: {
        open: data.price,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: parseFloat(data.lastDividend) || null,
      },
      create: {
        open: data.price,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: parseFloat(data.lastDividend) || null,
      },
    });

    console.log(`✅ Запись за ${today} обновлена (open, макро)`);
  } catch (error) {
    console.error("❌ Ошибка в saveOpenAndMacro:", err);
  }
}

export async function saveClose() {
  try {
    const data = await getTLTData();
    if (!data.price || data.price === 0) {
      console.warn("Цена не получена, скипаем");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    await prismaClient.dailyData.upsert({
      where: { date: today },
      update: { close: data.price },
      create: {
        date: today,
        close: data.price,
      },
    });

    console.log(`✅ Запись за ${today} обновлена (close)`);
  } catch (error) {
    console.error(error);
  }
}

export function startDailyTasks() {
  cron.schedule("1 21 * * *", saveOpen);
  cron.schedule("0 20 * * *", saveClose);
  console.log(
    "⏳ Планировщик запущен: open в 17:43 UTC (20:43 МСК), close в 20:00 UTC (23:00 МСК)",
  );
}
