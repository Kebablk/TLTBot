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
    const { nominalYield, realYield } = calculateYields(
      data.price,
      dividend,
      inflation,
    );

    let reply = `📊 **API (сейчас)**:\n\n🏷️ Цена TLT: $${data.price}\n💰 Купон: ${data.lastDividend}, ${data.lastExDate}\n🏦 Ставка ФРС: ${data.fedRate}\n📈 Уровень инфляции США: ${data.inflationRate}\n🗒️ Номинальная доходность: ${nominalYield}\n🗒️ Реальная доходность: ${realYield}\n\n📁 **БД (последняя запись)**:\n\n📆 Дата: ${lastRecord.date}\n🔓 Открытие TLT: ${lastRecord.open}\n🔒 Закрытие TLT: ${lastRecord.close}\n💰 Купон: ${lastRecord.dividend}\n🏦 Ставка ФРС: ${lastRecord.fedRate}\n📈 Уровень инфляции США: ${lastRecord.inflation}\n🗒️ Номинальная доходность: ${nominalYield}\n🗒️ Реальная доходность: ${realYield}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
