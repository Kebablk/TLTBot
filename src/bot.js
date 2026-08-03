import { Bot } from "grammy";
import getData from "./replies/replies.js";
import { startDailyTasks } from "./core/dataProvider.js";
import { mainKeyboard } from "./keyboards/keyboards.js";
import dotenv from "dotenv";
import express from "express";
dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const BOT = new Bot(TOKEN);

BOT.command("start", async (ctx) => {
  await ctx.reply(
    "Привет! Я бот для отслеживания TLT. Нажмите кнопку ниже для получения данных.",
    {
      reply_markup: mainKeyboard,
    },
  );
});

BOT.command("data", async (ctx) => {
  const reply = await getData();
  await ctx.reply(reply, { reply_markup: mainKeyboard });
});
BOT.hears("📊 Данные", async (ctx) => {
  const reply = await getData();
  await ctx.reply(reply, { reply_markup: mainKeyboard });
});
BOT.catch((err) => {
  console.error("Global error: ", err);
});

startDailyTasks();
BOT.start();
console.log("BOT запущен");

const app = express();
app.get("/", (req, res) => res.send("Бот работает"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Веб-сервер запущен на порту ${PORT} (для Render)`);
});
