// действия бота (тг)
import { getTLTData } from "./repliesStrategy.js";

export default async function getData(ctx) {
  try {
    const data = await getTLTData();

    let reply = `🏷️ Цена TLT: $${data.price}\n💰 Дивиденд: ${data.lastDividend}, ${data.lastExDate}\n🏦 Ставка ФРС: ${data.fedRate}\n📈 Уровень инфляции США: ${data.inflationRate}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
