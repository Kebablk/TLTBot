// действия бота (тг)
import { getTLTData } from "../core/strategy.js";

export default async function getData(ctx) {
  try {
    const data = await getTLTData();

    let reply = `Цена TLT: $${data.price}\nКупоны: ${data.lastDividend}, ${data.lastExDate}\nСтавка ФРС: ${data.fedRate}\nУровень инфляции США: ${data.inflationRate}`;
    return reply;
  } catch (err) {
    await ctx.reply("❌ Ошибка получения данных");
    console.error(err);
    return;
  }
}
