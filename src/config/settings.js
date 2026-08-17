import YahooFinance from "yahoo-finance2";
import prisma from "../lib/prismaClient.js";

const yahooFinance = new YahooFinance();

export function calculateYields(price, dividend, inflation) {
  if (!price || price === 0 || !dividend || dividend === 0) {
    return { nominalYield: null, realYield: null };
  }

  const nominalYield = (dividend / price) * 12 * 100;

  let realYield = null;
  if (inflation && inflation !== 0) {
    realYield = ((1 + nominalYield / 100) / (1 + inflation / 100) - 1) * 100;
  }

  return { nominalYield, realYield };
}
