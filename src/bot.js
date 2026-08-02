import { Bot } from "grammy";
import { getTLTPrice } from "./core/strategy";

const TOKEN = "8583323595:AAGZ8NQ4YpFHPO_1o67czZqX1z4LftsSkbU";
const BOT = new Bot(TOKEN);

BOT.command("start", (ctx) => {
  ctx.reply("Hi! I'm the TLT Bot.");
  getTLTPrice();
});

BOT.on("message:text", (ctx) => {
  ctx.reply(`You wrote: ${ctx.message.text}`);
});

BOT.start();
console.log("BOT запущен");
