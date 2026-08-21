// действия бота (тг)
import prisma from "../lib/prismaClient.js";
import { getTLTData } from "./repliesStrategy.js";
import { calculateYields } from "../config/settings.js";
import { calculateAndSetCombinations } from "../config/combinations.js";

function formatNumber(value, digits = 2) {
  return value !== null && value !== undefined ? value.toFixed(digits) : "нет";
}

export async function getData(ctx) {
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
    const existing = await prisma.dailyData.findFirst({
      orderBy: { date: "desc" },
    });
    const APIYields = calculateYields(
      data.price,
      data.lastDividend,
      data.inflationRate,
    );

    let reply = `📊 <b>API (сейчас)</b>:\n\n🏷️ Цена TLT: $${data.price.toFixed(2)}\n💰 Купон: ${data.lastDividend.toFixed(3)}, ${data.lastExDate}\n🏦 Ставка ФРС: ${data.fedRate.toFixed(2)}\n📈 Инфляция США: ${data.inflationRate.toFixed(2)}\n🗒️ nominalYield: ${APIYields.nominalYield.toFixed(2)}\n🗒️ realYield: ${APIYields.realYield.toFixed(2)}\n\n📁 <b>БД (последняя запись)</b>:\n\n📆 Дата: ${existing.date}\n🔓 Открытие TLT: ${formatNumber(existing.open)}\n🔒 Закрытие TLT: ${formatNumber(existing.close)}\n💰 Купон: ${formatNumber(existing.dividend, 3)}\n🏦 Ставка ФРС: ${formatNumber(existing.fedRate)}\n📈 Инфляция США: ${formatNumber(existing.inflation)}\n🗒️ nominalYield:  ${formatNumber(existing.nominalYield)}\n🗒️ realYield: ${formatNumber(existing.realYield)}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}

export async function getBottomZone(ctx) {
  try {
    const data = await calculateAndSetCombinations();

    let reply = `📊 <b>Зона дна</b>:\n\n⚓ Якорь 1 (Падение от годового пика): $${data.anchors[0]}\n⚓ Якорь 2 (Достижение предыдущего дна): ${data.anchors[1]}\n⚓ Якорь 3: ${data.anchors[2]}\n\n✅ Подтверждение 1 (Годовой минимум): ${data.confirms[0]}\n✅ Подтверждение 2 (RSI): ${data.confirms[1]}\n✅ Подтверждение 3 (Реальная доходность): ${data.confirms[2]}\n✅ Подтверждение 4 (Ставка ФРС): ${data.confirms[3]}\n✅ Подтверждение 5 (MA50): ${data.confirms[4]}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
