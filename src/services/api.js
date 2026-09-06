const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwnXVzDqzDLUhD6CjEK5jxy0z2UfbvgFM-j8osQ9vTvp_I58aBSBKInaEVAlreFDx7azA/exec";

export const fetchCurrencyData = async () => {
  try {
    const res = await fetch(`${WEB_APP_URL}?sheetName=CurrencyLog&t=${new Date().getTime()}`);
    const data = await res.json();
    return data.status === "success" ? data.data : [];
  } catch (error) {
    console.error("Error fetching currency:", error);
    return [];
  }
};

export const fetchTradeData = async () => {
  try {
    const res = await fetch(`${WEB_APP_URL}?sheetName=TradeLog&t=${new Date().getTime()}`);
    const data = await res.json();
    return data.status === "success" ? data.data : [];
  } catch (error) {
    console.error("Error fetching trade:", error);
    return [];
  }
};

export const fetchMarketData = async () => {
  try {
    const res = await fetch(`${WEB_APP_URL}?sheetName=MarketData`);
    const data = await res.json();
    if (data.status === "success") {
       let marketMap = {};
       let globalExchangeRate = 35.0; // Fallback
       data.data.forEach(item => {
           let price = parseFloat(item.manualPrice);
           if (isNaN(price) || price <= 0) price = parseFloat(item.autoPrice);
           if (!isNaN(price) && item.symbol) marketMap[item.symbol.toUpperCase()] = price;
           if (item.symbol && item.symbol.toUpperCase() === "USDTHB" && !isNaN(price)) globalExchangeRate = price;
       });
       return { marketMap, globalExchangeRate };
    }
    return { marketMap: {}, globalExchangeRate: 35.0 };
  } catch (error) {
    console.error("Error fetching market data:", error);
    return { marketMap: {}, globalExchangeRate: 35.0 };
  }
};

export const fetchPriceHistory = async () => {
  try {
    const res = await fetch(`${WEB_APP_URL}?sheetName=PriceHistory`);
    const data = await res.json();
    return data.status === "success" ? data.data : [];
  } catch (error) {
    console.error("Error fetching price history:", error);
    return [];
  }
};

export const submitData = async (payload) => {
  try {
    const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (error) {
    console.error("Error submitting data:", error);
    throw error;
  }
};
