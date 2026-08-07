// набор правил
let openTLT = 182.28
let closeTLT = 183.20
let devidend = 0.318
let inflation = 3.5

const nominalYield = (devidend / closeTLT) * 12 * 100 // номинальная доходность
const realYeiel = ((1 + nominalYield) / (1 + inflation / 100) - 1) * 100 // реальная доходность