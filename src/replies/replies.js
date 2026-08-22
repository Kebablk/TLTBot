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

    let anchorsCount = 0;
    let confirmsCount = 0;
    let combinationsCount = 0;
    for (let i = 0; i < data.anchors.length; i++) {
      if (data.anchors[i]) anchorsCount++;
    }
    for (let i = 0; i < data.confirms.length; i++) {
      if (data.confirms[i]) confirmsCount++;
    }
    for (let i = 0; i < data.combinations.length; i++) {
      if (data.combinations[i]) combinationsCount++;
    }
    let reply =
      `📊 <b>Статус системы (Зона дна)</b>:\n\n` +
      `⚓ <b>ЯКОРЯ</b>\n` +
      `--------------------\n` +
      `(${data.anchors[0] ? "<b>✅ ДА</b>" : "нет"}) ⚓ <b>Якорь 1</b> (падение от годового пика больше 20%)\n` +
      `(${data.anchors[1] ? "<b>✅ ДА</b>" : "нет"}) ⚓ <b>Якорь 2</b> (достижение предыдущего дна)\n` +
      `(${data.anchors[2] ? "<b>✅ ДА</b>" : "нет"}) ⚓ <b>Якорь 3</b> (объем больше 2x среднего)\n\n` +
      `📊 ПОДТВЕРЖДЕНИЯ\n` +
      `--------------------\n` +
      `(${data.confirms[0] ? "<b>ДА</b>" : "нет"}) 📉 <b>Годовой минимум</b>\n` +
      `(${data.confirms[1] ? "<b>ДА</b>" : "нет"}) ✉️ <b>RSI меньше 30</b>\n` +
      `(${data.confirms[2] ? "<b>ДА</b>" : "нет"}) 📈 <b>Реальная доходность больше 0</b>\n` +
      `(${data.confirms[3] ? "<b>ДА</b>" : "нет"}) 🏦 <b>Ставка ФРС больше 4.0%</b>\n` +
      `(${data.confirms[4] ? "<b>ДА</b>" : "нет"}) 🏷️ <b>Цена ниже MA50</b>\n\n` +
      `🎯 <b>ИТОГ</b>\n` +
      `--------------------\n` +
      `<b>Якорей:</b> <b>${anchorsCount}</b> из ${data.anchors.length}\n` +
      `<b>Подтверждений:</b> <b>${confirmsCount}</b> из ${data.confirms.length}\n` +
      `Сигнал к покупке: <b>${combinationsCount > 0 ? "ДА" : "НЕТ"}</b> ⛔`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
