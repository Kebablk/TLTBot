import cron from "node-cron";
import dotenv from "dotenv";
import { getTLTData } from "../replies/repliesStrategy.js";
import prisma from "../lib/prismaClient.js";

dotenv.config();

export async function saveOpen() {
  try {
    const data = await getTLTData();
    if (!data.price || data.price === 0) {
      console.warn("Цена не получена, скипаем");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    await prisma.dailyData.upsert({
      where: { date: today },
      update: {
        open: data.price,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: parseFloat(data.lastDividend) || null,
      },
      create: {
        date: today,
        open: data.price,
        fedRate: data.fedRate,
        inflation: data.inflationRate,
        dividend: parseFloat(data.lastDividend) || null,
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

    const today = new Date().toISOString().split("T")[0];

    await prisma.dailyData.upsert({
      where: { date: today },
      update: { close: data.price },
      create: {
        date: today,
        close: data.price,
      },
    });

    console.log(`✅ Запись за ${today} обновлена (close)`);
  } catch (error) {
    console.error("❌ Ошибка в saveClose:", error);
  }
}

export function startDailyTasks() {
  cron.schedule("30 13 * * *", saveOpen);
  cron.schedule("0 20 * * *", saveClose);
  console.log(
    "⏳ Планировщик запущен: open в 17:43 UTC (20:43 МСК), close в 20:00 UTC (23:00 МСК)",
  );
}

export async function getFirstData() {
  const lastData = await prisma.dailyData.findFirst({
    orderBy: { date: "desc" },
  });
  console.log("lastData: ", lastData);

  if (lastData) {
    const openTLT = lastData.open;
    const closeTLT = lastData.close;
    const dividend = lastData.dividend;
    const inflation = lastData.inflation;
    const fedRate = lastData.fedRate;

    let nominalYield = 0;
    let realYield = 0;
    if (closeTLT && closeTLT !== 0 && dividend && dividend !== 0)
      nominalYield = (dividend / closeTLT) * 12 * 100;
    if (nominalYield !== 0 && inflation && inflation !== 0)
      realYield = ((1 + nominalYield / 100) / (1 + inflation / 100) - 1) * 100;

    console.log(nominalYield, realYield);
    return { nominalYield, realYield };
  } else {
    console.log("Неудача");
    return;
  }
}
