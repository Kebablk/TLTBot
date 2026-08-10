import cron from "node-cron";
import dotenv from "dotenv";
import { getTLTData } from "../replies/repliesStrategy.js";
import prisma from "../lib/prismaClient.js";

dotenv.config();

function calculateYields(price, dividend, inflation) {
  if (!price || price === 0 || !dividend || dividend === 0) {
    return { nominalYield: null, realYield: null };
  }

  const nominalYield = (dividend / price) * 12 * 100;

  let realYield = null;
  if (inflation && inflation !== 0) {
    realYield = ((1 + nominalYield / 100) / (1 + inflation / 100) - 1) * 100;
  }

  return { nominalYield, realYield };
}

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

    const existing = await prisma.dailyData.findUnique({
      where: { date: today },
      select: { dividend: true, inflation: true },
    });

    const dividend = existing?.dividend ?? null;
    const inflation = existing?.inflation ?? null;

    const { nominalYield, realYield } = calculateYields(
      data.price,
      dividend,
      inflation,
    );

    await prisma.dailyData.upsert({
      where: { date: today },
      update: {
        close: data.price,
        nominalYield: nominalYield,
        realYield: realYield,
      },
      create: {
        date: today,
        close: data.price,
        nominalYield: nominalYield,
        realYield: realYield,
      },
    });

    console.log(`✅ Запись за ${today} обновлена (close)`);
  } catch (error) {
    console.error("❌ Ошибка в saveClose:", error);
  }
}

export function startDailyTasks() {
  cron.schedule("11 20 * * *", saveOpen);
  cron.schedule("12 20 * * *", saveClose);
  console.log(
    "⏳ Планировщик запущен: open в 17:43 UTC (20:43 МСК), close в 20:00 UTC (23:00 МСК)",
  );
}
