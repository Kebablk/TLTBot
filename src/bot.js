import { Bot, webhookCallback } from "grammy";
import getData from "./replies/replies.js";
import { mainKeyboard } from "./keyboards/keyboards.js";
import dotenv from "dotenv";
import express from "express";
import { startDailyTasks, setTwoYearsData } from "./core/dataProvider.js";
import prisma from "./lib/prismaClient.js";
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

BOT.hears("📊 Данные", async (ctx) => {
  const reply = await getData();

  await ctx.reply(reply, {
    reply_markup: mainKeyboard,
    parse_mode: "HTML",
  });
});
BOT.catch((err) => {
  console.error("Global error: ", err);
});

// BOT.command("testopen", async (ctx) => {
//   try {
//     await ctx.reply("⏳ Запускаю тестовую запись open...");
//     await saveOpen();
//     await ctx.reply("✅ Тестовая запись open выполнена. Проверьте БД.");
//   } catch (error) {
//     console.error("Ошибка в testopen:", error);
//     await ctx.reply("❌ Ошибка при выполнении testopen");
//   }
// });

// BOT.command("testclose", async (ctx) => {
//   try {
//     await ctx.reply("⏳ Запускаю тестовую запись close...");
//     await saveClose();
//     await ctx.reply("✅ Тестовая запись close выполнена. Проверьте БД.");
//   } catch (error) {
//     console.error("Ошибка в testclose:", error);
//     await ctx.reply("❌ Ошибка при выполнении testclose");
//   }
// });

const app = express();
app.get("/health", (req, res) => {
  res.send("OK");
});

app.use(express.json());
app.post(`/webhook/${TOKEN}`, webhookCallback(BOT, "express"));

const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === "production";

(async function setHistory() {
  const data = await setTwoYearsData();
})();
startDailyTasks();

const SELF_PING_INTERVAL = 10 * 60 * 1000;
setInterval(() => {
  const url = `${process.env.RENDER_EXTERNAL_URL}/health`;
  fetch(url)
    .then(() => console.log("✅ Пинг успешен"))
    .catch(() => console.log("❌ Пинг не удался"));
}, SELF_PING_INTERVAL);

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
