// действия бота (тг)
import prisma from "../lib/prismaClient.js";
import { getTLTData } from "./repliesStrategy.js";
import { calculateYields } from "../config/settings.js";

function formatNumber(value, digits = 2) {
  return value !== null && value !== undefined ? value.toFixed(digits) : "нет";
}

export default async function getData(ctx) {
  try {
    const data = await getTLTData();
    const lastRecord = await prisma.dailyData.findFirst({
      orderBy: { date: "desc" },
      select: {
        date: true,
        open: true,
        close: true,
        fedRate: true,
        inflation: true,
        dividend: true,
      },
    });

    const today = new Date().toISOString().split("T")[0];
    const existing = await prisma.dailyData.findUnique({
      where: { date: today },
      select: { close: true, dividend: true, inflation: true },
    });
    const closeTLT = existing?.close ?? null;
    const dividend = existing?.dividend ?? null;
    const inflation = existing?.inflation ?? null;
    const DBYields = calculateYields(closeTLT, dividend, inflation);
    const APIYields = calculateYields(
      data.price,
      data.lastDividend,
      data.inflationRate,
    );

    let reply = `📊 <b>API (сейчас)</b>:\n\n🏷️ Цена TLT: $${data.price.toFixed(2)}\n💰 Купон: ${data.lastDividend.toFixed(3)}, ${data.lastExDate}\n🏦 Ставка ФРС: ${data.fedRate.toFixed(2)}\n📈 Инфляция США: ${data.inflationRate.toFixed(2)}\n🗒️ nominalYield: ${APIYields.nominalYield.toFixed(2)}\n🗒️ realYield: ${APIYields.realYield.toFixed(2)}\n\n📁 <b>БД (последняя запись)</b>:\n\n📆 Дата: ${lastRecord.date}\n🔓 Открытие TLT: ${formatNumber(lastRecord.open)}\n🔒 Закрытие TLT: ${formatNumber(lastRecord.close)}\n💰 Купон: ${formatNumber(lastRecord.dividend, 3)}\n🏦 Ставка ФРС: ${formatNumber(lastRecord.fedRate)}\n📈 Инфляция США: ${formatNumber(lastRecord.inflation)}\n🗒️ nominalYield:  ${formatNumber(DBYields.nominalYield)}\n🗒️ realYield: ${formatNumber(DBYields.realYield)}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
