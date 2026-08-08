import { getAllData } from "../core/dataProvider.js";
import prisma from "../lib/prismaClient.js";

const lastData = await prisma.dailyData.findFirst({
  orderBy: { date: "desc" },
});

const openTLT = lastData?.openTLT ?? 0;
const closeTLT = lastData?.closeTLT ?? 0;
const devidend = lastData?.devidend ?? 0;
const inflation = lastData?.inflation ?? 0;
const fedRate = lastData?.fedRate ?? 0;

let nominalYield = 0;
let realYield = 0;
if (closeTLT !== 0 && dividend !== 0)
  nominalYield = (dividend / closeTLT) * 12 * 100;
if (nominalYield !== 0 && inflation !== 0)
  realYield = ((1 + nominalYield) / (1 + inflation / 100) - 1) * 100;

export { nominalYield, realYield };
