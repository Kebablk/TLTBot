import prisma from "../lib/prismaClient.js";

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

export async function calculateAnnualPeak(closeTLT) {
  const yearlyHigh = await prisma.dailyData.aggregate({
    where: {
      date: {
        gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
          .toISOString()
          .split("T")[0],
      },
    },
    _max: {
      close: true,
    },
  });

  const yearlyMax = yearlyHigh._max.close || null;

  return ((yearlyMax - closeTLT) / yearlyMax) * 100;
}
