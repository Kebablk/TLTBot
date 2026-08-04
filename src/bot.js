import { Bot, webhookCallback } from "grammy";
import getData from "./replies/replies.js";
import {
  saveClose,
  saveOpenAndMacro,
  startDailyTasks,
} from "./core/dataProvider.js";
import { mainKeyboard } from "./keyboards/keyboards.js";
import dotenv from "dotenv";
import express from "express";
import fs from "fs/promises";
import { DATA_FILE } from "./core/dataProvider.js";
import path from "path";
dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const BOT = new Bot(TOKEN);

if (!TOKEN) {
  console.error("❌ BOT_TOKEN не найден в .env");
  process.exit(1);
}

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

BOT.command("testopen", async (ctx) => {
  await saveOpenAndMacro();
  await ctx.reply("✅ Тестовая запись open выполнена, проверьте data.json");
});

BOT.command("testclose", async (ctx) => {
  await saveClose();
  await ctx.reply("✅ Тестовая запись close выполнена, проверьте data.json");
});

BOT.command("readfile", async (ctx) => {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(content);
    const last = data[data.length - 1];
    await ctx.reply(
      `📄 **Последняя запись из data.json:**\n` +
        `📅 Дата: ${last.date}\n` +
        `💰 Открытие: $${last.open ?? "нет"}\n` +
        `💵 Закрытие: $${last.close ?? "нет"}\n` +
        `🏦 Ставка ФРС: ${last.fedRate ?? "нет"}\n` +
        `📈 Инфляция: ${last.inflation ?? "нет"}\n` +
        `💵 Дивиденд: ${last.dividend ?? "нет"}`,
    );
  } catch (err) {
    console.error("Ошибка чтения файла:", err);
    await ctx.reply(`❌ Файл не найден или пуст. Путь: ${DATA_FILE}`);
  }
});

startDailyTasks();

const app = express();

app.get("/health", (req, res) => {
  res.send("OK");
});

app.use(express.json());
app.post(`/webhook/${TOKEN}`, webhookCallback(BOT, "express"));

const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);

    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook/${TOKEN}`;
    try {
      await BOT.api.setWebhook(webhookUrl, {
        drop_pending_updates: true,
      });
      console.log(`✅ Webhook установлен: ${webhookUrl}`);
    } catch (error) {
      console.error("❌ Ошибка установки webhook:", error);
    }
  });
} else {
  console.log("🔄 Локальный режим: запуск с polling");
  BOT.start();
  console.log("✅ Бот запущен (polling)");
}
