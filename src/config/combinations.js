import {
  calculateAnnualPeak,
  calculateVolumetricPanic,
  isHistoricalLowAnchorTriggered,
} from "../config/anchors.js";
import {
  calculateAnnualMinimumConf,
  checkFedRateConf,
  checkMA50Conf,
  checkRealYieldConf,
  checkRSIConf,
} from "../config/confirms.js";
import prisma from "../lib/prismaClient.js";

export async function convertionConfsAndAnchsToObj() {
  try {
    const lastRow = await prisma.dailyData.findFirst({
      orderBy: { date: "desc" },
      select: {
        open: true,
        close: true,
        fedRate: true,
        realYield: true,
      },
    });

    const [anchor1, anchor2, anchor3] = await Promise.all([
      calculateAnnualPeak(lastRow.close),
      isHistoricalLowAnchorTriggered(lastRow.close),
      calculateVolumetricPanic(lastRow.open, lastRow.close),
    ]);

    const [annualMinimumConf, RSIConf, realYieldConf, fedRateConf, MA50Conf] =
      await Promise.all([
        calculateAnnualMinimumConf(lastRow.close),
        checkRSIConf(),
        checkRealYieldConf(lastRow.realYield),
        checkFedRateConf(lastRow.fedRate),
        checkMA50Conf(lastRow.close),
      ]);

    return {
      anchors: [anchor1, anchor2, anchor3],
      confirms: [
        annualMinimumConf,
        RSIConf,
        realYieldConf,
        fedRateConf,
        MA50Conf,
      ],
    };
  } catch (error) {
    console.error("Ошибка в convertionConfsAndAnchsToObj:", error);
    return { anchors: [], confirms: [] };
  }
}

export async function checkCombinations() {
  const data = await convertionConfsAndAnchsToObj();
  let confirmed = 0;
  for (let i = 0; i < data.confirms.length; i++) {
    if (data.confirms[i] === true) confirmed++;
  }
}
