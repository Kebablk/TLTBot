// src/core/dataProvider.js
import fs from "fs/promises";
import path from "path";
import cron from "node-cron";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { getTLTData } from "../replies/repliesStrategy.js"; // ← импортируем основную функцию

dotenv.config();

// === Определяем путь к файлу данных ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isRender = process.env.RENDER === "true";
const DATA_DIR = isRender ? "/data" : path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");

console.log("📁 DATA_FILE path:", DATA_FILE);

// === Работа с файлом ===
async function loadData() {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveData(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`💾 Данные сохранены в ${DATA_FILE}`);
}

async function upsertTodayEntry(updates) {
  const today = new Date().toISOString().split("T")[0];
  let data = await loadData();
  const index = data.findIndex((entry) => entry.date === today);

  if (index === -1) {
    data.push({
      date: today,
      open: null,
      close: null,
      fedRate: null,
      inflation: null,
      dividend: null,
      ...updates,
    });
  } else {
    data[index] = { ...data[index], ...updates };
  }

  await saveData(data);
  console.log(`✅ Запись за ${today} обновлена:`, updates);
}

// === Задача в 16:30 (или 20:43) – записать open и макропараметры ===
async function saveOpenAndMacro() {
  console.log(`⏰ Запись open и макроданных (${new Date().toISOString()})`);
  try {
    // Получаем все данные через основную функцию
    const data = await getTLTData();

    // Проверяем, что цена получена
    if (!data.price || data.price === 0) {
      console.warn("⚠️ Цена не получена, пропускаем");
      return;
    }

    // Сохраняем в data.json
    await upsertTodayEntry({
      open: data.price, // текущая цена используется как open
      fedRate: data.fedRate,
      inflation: data.inflationRate,
      dividend: parseFloat(data.lastDividend) || null,
    });
  } catch (err) {
    console.error("❌ Ошибка в saveOpenAndMacro:", err);
  }
}

// === Задача в 23:00 – записать close ===
async function saveClose() {
  console.log(`⏰ Запись close (${new Date().toISOString()})`);
  try {
    // Получаем все данные через основную функцию
    const data = await getTLTData();

    if (!data.price || data.price === 0) {
      console.warn("⚠️ Цена не получена, пропускаем");
      return;
    }

    await upsertTodayEntry({ close: data.price });
  } catch (err) {
    console.error("❌ Ошибка в saveClose:", err);
  }
}

// === Экспорт функции запуска планировщика ===
export function startDailyTasks() {
  // Время указано в UTC
  cron.schedule("43 17 * * *", saveOpenAndMacro); // 20:43 МСК
  cron.schedule("0 20 * * *", saveClose); // 23:00 МСК
  console.log(
    "⏳ Планировщик запущен: open в 17:43 UTC (20:43 МСК), close в 20:00 UTC (23:00 МСК)",
  );
}

export { saveOpenAndMacro, saveClose };
