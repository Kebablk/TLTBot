// действия бота (тг)
import prisma from "../lib/prismaClient.js";
import { getTLTData } from "./repliesStrategy.js";
import { calculateYields } from "../config/settings.js";

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
      select: { dividend: true, inflation: true },
    });
    const dividend = existing?.dividend ?? null;
    const inflation = existing?.inflation ?? null;
    const DBYields = calculateYields(data.price, dividend, inflation);
    const APIYields = calculateYields(
      data.price,
      data.lastDividend,
      data.inflationRate,
    );

    let reply = `📊 <b>API (сейчас)</b>:\n\n🏷️ Цена TLT: $${data.price.toFixed(2)}\n💰 Купон: ${data.lastDividend.toFixed(3)}, ${data.lastExDate}\n🏦 Ставка ФРС: ${data.fedRate.toFixed(2)}\n📈 Инфляция США: ${data.inflationRate.toFixed(2)}\n🗒️ nominalYield: ${APIYields.nominalYield.toFixed(2)}\n🗒️ realYield: ${APIYields.realYield.toFixed(2)}\n\n📁 <b>БД (последняя запись)</b>:\n\n📆 Дата: ${lastRecord.date}\n🔓 Открытие TLT: ${lastRecord.open}\n🔒 Закрытие TLT: ${lastRecord.close}\n💰 Купон: ${lastRecord.dividend}\n🏦 Ставка ФРС: ${lastRecord.fedRate}\n📈 Инфляция США: ${lastRecord.inflation}\n🗒️ nominalYield:  ${DBYields.nominalYield}\n🗒️ realYield: ${DBYields.realYield}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
