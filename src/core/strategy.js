// принимает решение
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function getTLTPrice() {
  try {
    const quote = await yahooFinance.quote("TLT");
    console.log("Цена TLT:", quote.regularMarketPrice);
    return quote.regularMarketPrice;
  } catch (error) {
    console.error("Ошибка получения цены:", error);
  }
}
