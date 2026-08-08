import { getAllData } from "../core/dataProvider";

const lastData = getAllData()[0];

const openTLT = lastData.openTLT;
const closeTLT = lastData.closeTLT;
const devidend = lastData.devidend;
const inflation = lastData.inflation;
const fedRate = lastData.fedRate;

export const nominalYield = (devidend / closeTLT) * 12 * 100; // номинальная доходность
export const realYeiel = ((1 + nominalYield) / (1 + inflation / 100) - 1) * 100; // реальная доходность
