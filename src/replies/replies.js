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

    let reply =
      `📊 <b>Статус системы (Зона дна)</b>:\n\n` +
      `⚓ ЯКОРЯ (обязательные)\n` +
      `--------------------\n` +
      `⚓ 1. Падение от годового пика > 20%: ${data.anchors[0] ?? "нет"}\n` +
      `⚓ 2. Достижение предыдущего дна: ${data.anchors[1] ?? "нет"}\n` +
      `⚓ 3. Объем > 2x среднего: ${data.anchors[2] ?? "нет"}\n\n` +
      `📊 ПОДТВЕРЖДЕНИЯ (5 фильтров)\n` +
      `--------------------\n` +
      `📊 1. Годовой минимум: ${data.confirms[0] ?? "нет"}\n` +
      `📊 2. RSI < 30: ${data.confirms[1] ?? "нет"}\n` +
      `📊 3. Реальная доходность > 0: ${data.confirms[2] ?? "нет"}\n` +
      `📊 4. Ставка ФРС > 4.0%: ${data.confirms[3] ?? "нет"}\n` +
      `📊 5. Цена ниже MA50: ${data.confirms[4] ?? "нет"}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
