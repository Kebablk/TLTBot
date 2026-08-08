// принимает решение
import { openTLT } from "../config/settings"
import { closeTLT } from "../config/settings"
import { fedRate } from "../config/settings"
import { inflation } from "../config/settings"
import { devidend } from "../config/settings"

const buy = () => {
  console.log(`покупаем облигации, потому что реальная доходность TLT ${realYield} > 0 и цена TLT ${TLT} < 85 и ставка ФРС ${fedRate} > 3.5 (высокая)`)
}
const sell = () => {
  console.log(`продаем облигации, потому что цена TLT ${TLT} > 99`)
}
const stay = () => {
  console.log('ничего не делаем')
}

let nominalYield = (devidend / closeTLT * 12 * 100)
let realYield = ((1 + nominalYield / 100) / (1 + inflation / 100) - 1) * 100

if (realYield > 0 && TLT < 85 && FRS > 3.5) {
  buy()
} else if (TLT > 99) {
  sell()
} else {
  stay()
}