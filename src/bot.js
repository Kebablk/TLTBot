import { Bot } from "grammy";
import getData from "./replies/replies.js";

const TOKEN = "8583323595:AAGZ8NQ4YpFHPO_1o67czZqX1z4LftsSkbU";
const BOT = new Bot(TOKEN);

BOT.command("data", getData);
BOT.catch((err) => {
  console.error("Global error: ", err);
});

BOT.start();
console.log("BOT запущен");
