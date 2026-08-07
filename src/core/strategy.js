// принимает решение
let openTLT = 182.28
let closeTLT = 183.20
let devidend = 0.318
let fedRate = 3.75
let inflation = 3.5

const buy = () => {
  console.log(`покупаем облигации, потому что реальная доходность TLT ${realYield} > 0 и цена TLT ${TLT} < 85 и ставка ФРС ${fedRate} > 3.5 (высокая)`)
}
const sell = () => {
  console.log(`продаем облигации, потому что цена TLT ${TLT} > 99`)
}
const stay = () => {
  console.log('ничего не делаем')
}

let nominalYield = (devidend / TLT * 12 * 100)
let realYield = ((1 + nominalYield / 100) / (1 + inflation / 100) - 1) * 100

if (realYield > 0 && TLT < 85 && FRS > 3.5) {
  buy()
} else if (TLT > 99) {
  sell()
} else {
  stay()
}