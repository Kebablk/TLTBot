import prisma from "../lib/prismaClient.js";

export async function getFirstData() {
  const lastData = await prisma.dailyData.findFirst({
    orderBy: { date: "desc" },
  });
  console.log("lastData: ", lastData);

  if (lastData) {
    const openTLT = lastData.open;
    const closeTLT = lastData.close;
    const dividend = lastData.dividend;
    const inflation = lastData.inflation;
    const fedRate = lastData.fedRate;

    let nominalYield = 0;
    let realYield = 0;
    if (closeTLT && closeTLT !== 0 && dividend && dividend !== 0)
      nominalYield = (dividend / closeTLT) * 12 * 100;
    if (nominalYield !== 0 && inflation && inflation !== 0)
      realYield = ((1 + nominalYield / 100) / (1 + inflation / 100) - 1) * 100;

    console.log(nominalYield, realYield);
    return { nominalYield, realYield };
  } else {
    return { nominalYield: 0, realYield: 0 };
  }
}
