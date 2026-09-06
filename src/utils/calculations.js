// src/utils/calculations.js

// 1. คำนวณค่าเงินและพอร์ต Currency
export const calculateCurrencyStats = (currencyData, liveRate) => {
  let totalUSD = 0;
  let totalTHBCost = 0;
  let totalRealizedPL = 0;

  currencyData.forEach(item => {
      let amt = parseFloat(item.amount) || 0;
      let conv = parseFloat(item.converted) || 0;
      
      if (item.type === 'Buy USD') {
          totalUSD += conv;
          totalTHBCost += amt;
      } else if (item.type === 'Sell USD') {
          let currentAvgRate = totalUSD > 0 ? (totalTHBCost / totalUSD) : 0;
          if (amt > totalUSD) {
              let costOfSoldUSD = totalTHBCost;
              totalUSD = 0;
              totalTHBCost = 0;
              totalRealizedPL += (conv - costOfSoldUSD);
          } else {
              totalUSD -= amt;
              let costOfSoldUSD = amt * currentAvgRate;
              totalTHBCost -= costOfSoldUSD;
              totalRealizedPL += (conv - costOfSoldUSD);
          }
      }
  });

  let averageRate = totalUSD > 0 ? (totalTHBCost / totalUSD) : 0;
  let currentTHB = totalUSD * liveRate;
  let plTHB = currentTHB - totalTHBCost;
  let plUSD = liveRate > 0 ? plTHB / liveRate : 0;
  let growth = totalTHBCost > 0 ? (plTHB / totalTHBCost) * 100 : 0;

  return {
    totalUSD,
    totalTHBCost,
    averageRate,
    currentTHB,
    totalRealizedPL,
    plTHB,
    plUSD,
    growth
  };
};

// 2. คำนวณ Trade สถิติ (ปันผล, ดอกเบี้ย, ค่าธรรมเนียม)
export const calculateTradeStats = (trades, globalExchangeRate) => {
  let totalInterestTHB = 0, totalDividendTHB = 0, totalDividendTaxTHB = 0, totalTradingFeeTHB = 0;
  let totalInterestUSD = 0, totalDividendUSD = 0, totalDividendTaxUSD = 0, totalTradingFeeUSD = 0;

  trades.forEach(t => {
      let sym = String(t.symbol || "").toUpperCase().trim();
      let typeStr = String(t.type || "").toLowerCase().trim();
      let vol = Math.abs(parseFloat(t.volume) || 0);
      let price = Math.abs(parseFloat(t.price) || 0);
      let fee = Math.abs(parseFloat(t.fee) || 0);
      
      let isUSD = false;
      if (!t.portfolio.includes('กองทุน') && !t.portfolio.includes('คริปโต') && !t.portfolio.includes('Funds') && !t.portfolio.includes('Crypto')) {
          if (t.portfolio.includes('เงินสด') || t.portfolio.includes('Cash')) {
               if (sym.includes('USD') || sym.includes('FCD')) isUSD = true;
          } else {
               isUSD = true;
          }
      }
      
      let rate = isUSD ? globalExchangeRate : 1;
      let valTHB = (vol * price) * rate;
      let feeTHB = fee * rate;
      let valUSD = isUSD ? (vol * price) : (rate > 0 ? (vol * price) / rate : 0);
      let feeUSD = isUSD ? fee : (rate > 0 ? fee / rate : 0);
      
      if (typeStr.includes('dividend') || typeStr.includes('ปันผล')) {
          totalDividendTHB += valTHB;
          totalDividendTaxTHB += feeTHB;
          totalDividendUSD += valUSD;
          totalDividendTaxUSD += feeUSD;
      } else if (typeStr.includes('interest') || typeStr.includes('ดอกเบี้ย')) {
          totalInterestTHB += valTHB;
          totalInterestUSD += valUSD;
          if (feeTHB > 0) {
              totalDividendTaxTHB += feeTHB;
              totalDividendTaxUSD += feeUSD;
          }
      } else if (typeStr.includes('buy') || typeStr.includes('sell') || typeStr.includes('deposit') || typeStr.includes('withdraw') || typeStr.includes('ฝาก') || typeStr.includes('ถอน')) {
          totalTradingFeeTHB += feeTHB;
          totalTradingFeeUSD += feeUSD;
      }
  });

  return {
    netDividendTHB: totalDividendTHB - totalDividendTaxTHB,
    netDividendUSD: totalDividendUSD - totalDividendTaxUSD,
    totalFeesTHB: totalDividendTaxTHB + totalTradingFeeTHB,
    totalFeesUSD: totalDividendTaxUSD + totalTradingFeeUSD,
    totalInterestTHB,
    totalInterestUSD,
    totalDividendGrossTHB: totalDividendTHB,
    totalDividendGrossUSD: totalDividendUSD,
    totalDividendTaxTHB,
    totalDividendTaxUSD,
    totalTradingFeeTHB,
    totalTradingFeeUSD
  };
};

// Helper: Linear Interpolation for Chart Generation
const getInterpolatedPrice = (sym, targetDate, assetPricePoints) => {
    let points = assetPricePoints[sym];
    if (!points || points.length === 0) return 1;
    if (targetDate <= points[0].date) return points[0].price;
    if (targetDate >= points[points.length-1].date) return points[points.length-1].price;
    
    for (let i = 0; i < points.length - 1; i++) {
        if (targetDate >= points[i].date && targetDate <= points[i+1].date) {
            let p1 = points[i];
            let p2 = points[i+1];
            if (p1.date.getTime() === p2.date.getTime()) return p1.price;
            let ratio = (targetDate - p1.date) / (p2.date - p1.date);
            return p1.price + (p2.price - p1.price) * ratio;
        }
    }
    return points[points.length-1].price;
};

// 3. คำนวณ Dashboard ข้อมูลทั้งหมด (Donut Chart, Line Chart, Cards, Asset List)
export const processDashboardData = (globalTradeData, globalMarketData, globalPriceHistory, globalExchangeRate, selectedFilter, timeframe) => {
    let holdings = {};
    let realizedPL = 0;
    let totalCostBasis = 0;
    let maxNetCashInjectedUSD = 0;
    let currentNetCashInjectedUSD = 0;
    
    // ----------------------------------------
    // Part 1: Process current holdings and PL
    // ----------------------------------------
    globalTradeData.forEach(trade => {
        let port = trade.portfolio;
        let isIncluded = false;
        
        if (selectedFilter === 'สินทรัพย์ทั้งหมด (Total Wealth)') {
            isIncluded = true;
        } else if (selectedFilter === 'หุ้น (Stocks)') {
            if (['Core Portfolio', 'Satellite Portfolio', 'Alpha Portfolio', 'Defensive Portfolio', 'Dividend Portfolio'].includes(port)) {
                isIncluded = true;
            }
        } else {
            if (port === selectedFilter) isIncluded = true;
        }
        
        let sym = String(trade.symbol || "").toUpperCase().trim();
        let typeStr = String(trade.type || "").toLowerCase().trim();
        let vol = Math.abs(parseFloat(trade.volume) || 0);
        let price = Math.abs(parseFloat(trade.price) || 0);
        let fee = Math.abs(parseFloat(trade.fee) || 0);
        let totalVal = Math.abs(parseFloat(trade.totalValue) || 0);
        
        let isBuy = typeStr.includes('buy') || typeStr.includes('deposit') || typeStr.includes('ฝาก');
        let isSell = typeStr.includes('sell') || typeStr.includes('withdraw') || typeStr.includes('ถอน');
        let isInterest = typeStr.includes('dividend') || typeStr.includes('interest') || typeStr.includes('ดอกเบี้ย') || typeStr.includes('ปันผล');
        
        if (port.includes('เงินสด') || port.includes('Cash') || sym.includes('DIME') || sym.includes('CASH')) {
            if (totalVal > 0) vol = totalVal;
            else if (vol > 0 && price > 0) vol = vol * price;
            price = 1;
        }
        
        let currency = 'USD';
        if (port.includes('กองทุน') || port.includes('Funds') || port.includes('คริปโต') || port.includes('Crypto')) currency = 'THB';
        else if (port.includes('เงินสด') || port.includes('Cash')) {
            if (sym.includes('USD') || sym.includes('FCD')) currency = 'USD';
            else currency = 'THB';
        }
        
        let priceUSD = price;
        let feeUSD = fee;
        if (currency === 'THB') {
            priceUSD = price / globalExchangeRate;
            feeUSD = fee / globalExchangeRate;
        }
        
        if (!holdings[port]) holdings[port] = {};
        if (!holdings[port][sym]) {
            holdings[port][sym] = { volume: 0, totalCost: 0, totalCostBase: 0, averageCost: 0, baseCurrency: currency };
        }
        
        let asset = holdings[port][sym];
        
        if (isBuy) {
            asset.volume += vol;
            let buyCost = (vol * priceUSD) + feeUSD;
            let buyCostBase = (vol * price) + fee;
            asset.totalCost += buyCost;
            asset.totalCostBase += buyCostBase;
            
            if (isIncluded) {
                currentNetCashInjectedUSD += buyCost;
                if (currentNetCashInjectedUSD > maxNetCashInjectedUSD) maxNetCashInjectedUSD = currentNetCashInjectedUSD;
            }
            if (asset.volume > 0) asset.averageCost = asset.totalCost / asset.volume;
        } 
        else if (isSell) {
            if (asset.volume > 0) {
                let costToDeduct = asset.averageCost * vol;
                let avgCostBase = asset.totalCostBase / asset.volume;
                let costBaseToDeduct = avgCostBase * vol;
                
                asset.totalCost -= costToDeduct;
                asset.totalCostBase -= costBaseToDeduct;
                asset.volume -= vol;
                
                if (isIncluded) {
                    let proceeds = (vol * priceUSD) - feeUSD;
                    currentNetCashInjectedUSD -= proceeds;
                    if (typeStr.includes('sell')) realizedPL += (proceeds - costToDeduct);
                }
            }
        }
        else if (isInterest) {
            let effectivePrice = price > 0 ? price : 1;
            let interestAmt = totalVal > 0 ? totalVal : ((vol * effectivePrice) - (currency === 'THB' ? fee : feeUSD));
            let proceeds = currency === 'THB' ? (interestAmt / globalExchangeRate) : interestAmt;
            
            if (isIncluded) {
                realizedPL += proceeds;
                currentNetCashInjectedUSD -= proceeds;
            }
            
            if (interestAmt > 0) {
                let isCash = port.includes('เงินสด') || port.includes('Cash') || sym.includes('CASH') || sym.includes('DIME');
                let targetPort = isCash ? port : "เงินสด (Cash)";
                let targetSym = isCash ? sym : "DIME USD"; 
                
                if (!isCash && (port.includes('กองทุน') || port.includes('Funds') || port.includes('คริปโต') || port.includes('Crypto'))) {
                    targetSym = "DIME SAVE";
                }
                
                if (!holdings[targetPort]) holdings[targetPort] = {};
                if (!holdings[targetPort][targetSym]) {
                    let baseCurr = (targetSym === "DIME SAVE") ? 'THB' : 'USD';
                    holdings[targetPort][targetSym] = { volume: 0, totalCost: 0, totalCostBase: 0, averageCost: 0, baseCurrency: baseCurr };
                }
                
                let targetAsset = holdings[targetPort][targetSym];
                targetAsset.volume += interestAmt;
                
                let intPriceUSD = currency === 'THB' ? (interestAmt / globalExchangeRate) : interestAmt;
                let intPriceBase = interestAmt;
                
                targetAsset.totalCost += intPriceUSD;
                targetAsset.totalCostBase += intPriceBase;
                
                let targetIncluded = (selectedFilter === 'สินทรัพย์ทั้งหมด (Total Wealth)') || (selectedFilter === targetPort);
                if (targetIncluded) {
                    currentNetCashInjectedUSD += intPriceUSD;
                    if (currentNetCashInjectedUSD > maxNetCashInjectedUSD) maxNetCashInjectedUSD = currentNetCashInjectedUSD;
                }
                if (targetAsset.volume > 0) targetAsset.averageCost = targetAsset.totalCost / targetAsset.volume;
            }
        }
    });

    let breakdown = {};
    let assetList = [];
    let totalUnrealizedPL_USD = 0;

    const processAsset = (port, sym, assetData) => {
        let vol = assetData.volume;
        let avgCost = assetData.averageCost;
        let costBasisUSD = vol * avgCost;
        
        if (vol <= 0.0001) return null;
        
        let isCash = sym.includes('CASH') || port.includes('เงินสด') || sym.includes('DIME');
        let marketValueUSD;
        
        if (isCash) {
            if (assetData.baseCurrency === 'THB') costBasisUSD = assetData.totalCostBase / globalExchangeRate;
            else costBasisUSD = assetData.totalCostBase;
            marketValueUSD = costBasisUSD;
        } else {
            let currentPrice = globalMarketData[sym];
            marketValueUSD = costBasisUSD; 
            
            if (currentPrice) {
                if (assetData.baseCurrency === 'THB') marketValueUSD = (vol * currentPrice) / globalExchangeRate;
                else marketValueUSD = vol * currentPrice;
            }
        }
        
        totalCostBasis += costBasisUSD;
        totalUnrealizedPL_USD += (marketValueUSD - costBasisUSD);

        return { vol, avgCost, costBasisUSD, marketValueUSD, baseCurrency: assetData.baseCurrency, isCash };
    };

    if (selectedFilter === 'สินทรัพย์ทั้งหมด (Total Wealth)') {
        breakdown = { "หุ้น (Stocks)": 0, "ทองคำ (Gold)": 0, "คริปโต (Crypto)": 0, "กองทุน (Funds)": 0, "เงินสด (Cash)": 0 };
        let groupCostBasis = { "หุ้น (Stocks)": 0, "ทองคำ (Gold)": 0, "คริปโต (Crypto)": 0, "กองทุน (Funds)": 0, "เงินสด (Cash)": 0 };
        
        for (let port in holdings) {
            for (let sym in holdings[port]) {
                let res = processAsset(port, sym, holdings[port][sym]);
                if (!res) continue;
                
                let groupName = port;
                if (['Core Portfolio', 'Satellite Portfolio', 'Alpha Portfolio', 'Defensive Portfolio', 'Dividend Portfolio'].includes(port)) groupName = "หุ้น (Stocks)";
                else if (port === 'ทองคำ (Gold)') groupName = "ทองคำ (Gold)";
                else if (port === 'คริปโต (Crypto)') groupName = "คริปโต (Crypto)";
                else if (port === 'กองทุน (Funds)') groupName = "กองทุน (Funds)";
                else if (port === 'เงินสด (Cash)') groupName = "เงินสด (Cash)";
                
                breakdown[groupName] = (breakdown[groupName] || 0) + res.marketValueUSD;
                groupCostBasis[groupName] = (groupCostBasis[groupName] || 0) + res.costBasisUSD;
            }
        }
        for(let key in breakdown) {
            if(breakdown[key] > 0) {
                assetList.push({ 
                    name: key, avgCost: null, costBasisUSD: groupCostBasis[key],
                    value: breakdown[key], baseCurrency: (key.includes('คริปโต') || key.includes('กองทุน') || key.includes('เงินสด')) ? 'THB' : 'MIX',
                    isCash: key.includes('เงินสด') || key.includes('Cash')
                });
            }
        }
    } else if (selectedFilter === 'หุ้น (Stocks)') {
        let groupCostBasis = {};
        for (let port of ['Core Portfolio', 'Satellite Portfolio', 'Alpha Portfolio', 'Defensive Portfolio', 'Dividend Portfolio']) {
            if (holdings[port]) {
                breakdown[port] = 0;
                groupCostBasis[port] = 0;
                for (let sym in holdings[port]) {
                    let res = processAsset(port, sym, holdings[port][sym]);
                    if (!res) continue;
                    breakdown[port] += res.marketValueUSD;
                    groupCostBasis[port] += res.costBasisUSD;
                }
            }
        }
        for(let key in breakdown) {
            if(breakdown[key] > 0) {
                assetList.push({ 
                    name: key, avgCost: null, costBasisUSD: groupCostBasis[key], value: breakdown[key], baseCurrency: 'USD',
                    isCash: false
                });
            }
        }
    } else {
        if (holdings[selectedFilter]) {
            for (let sym in holdings[selectedFilter]) {
                let res = processAsset(selectedFilter, sym, holdings[selectedFilter][sym]);
                if (!res) continue;
                breakdown[sym] = res.marketValueUSD;
                
                let displayAvgCost = res.baseCurrency === 'THB' ? res.avgCost * globalExchangeRate : res.avgCost;
                assetList.push({ 
                    name: sym, volume: res.vol, avgCost: displayAvgCost, 
                    costBasisUSD: res.costBasisUSD, value: res.marketValueUSD, baseCurrency: res.baseCurrency,
                    isCash: res.isCash
                });
            }
        }
    }

    let totalWealthUSD = totalCostBasis + totalUnrealizedPL_USD; 
    let totalWealthTHB = totalWealthUSD * globalExchangeRate;
    let totalPL_USD = realizedPL + totalUnrealizedPL_USD; 
    let totalPL_THB = totalPL_USD * globalExchangeRate;
    let totalPL_Pct = maxNetCashInjectedUSD > 0 ? (totalPL_USD / maxNetCashInjectedUSD) * 100 : 0;
    let totalUnrealizedPL_THB = totalUnrealizedPL_USD * globalExchangeRate;
    let totalUnrealizedPL_Pct = totalCostBasis > 0 ? (totalUnrealizedPL_USD / totalCostBasis) * 100 : 0;

    assetList.sort((a,b) => b.value - a.value);

    // ----------------------------------------
    // Part 2: Daily Walk for Line Chart
    // ----------------------------------------
    let filteredTrades = globalTradeData.filter(trade => {
        let port = trade.portfolio;
        if (selectedFilter === 'สินทรัพย์ทั้งหมด (Total Wealth)') return true;
        if (selectedFilter === 'หุ้น (Stocks)') return ['Core Portfolio', 'Satellite Portfolio', 'Alpha Portfolio', 'Defensive Portfolio', 'Dividend Portfolio'].includes(port);
        return port === selectedFilter;
    });

    filteredTrades.sort((a,b) => {
        let d1 = a.date.includes('T') ? a.date.split('T')[0] : a.date;
        let d2 = b.date.includes('T') ? b.date.split('T')[0] : b.date;
        return new Date(d1) - new Date(d2);
    });

    let now = new Date();
    now.setHours(0,0,0,0);
    let startDate = new Date(0);
    if (timeframe === '1M') startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    else if (timeframe === '3M') startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    else if (timeframe === '6M') startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    else if (timeframe === '1Y') startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    else if (timeframe === 'YTD') startDate = new Date(now.getFullYear(), 0, 1);

    let assetPricePoints = {};
    globalTradeData.forEach(t => {
        let sym = String(t.symbol || "").toUpperCase().trim();
        if (!sym) return;
        let dStr = t.date;
        if (dStr.includes('T')) dStr = dStr.split('T')[0];
        let p = parseFloat(t.price) || 0;
        let type = String(t.type || "").toLowerCase().trim();
        
        if (p > 0 && (type.includes('buy') || type.includes('sell') || type.includes('ฝาก') || type.includes('ถอน'))) {
            if (!assetPricePoints[sym]) assetPricePoints[sym] = [];
            assetPricePoints[sym].push({ date: new Date(dStr), price: p });
        }
    });
    
    if (globalPriceHistory && globalPriceHistory.length > 0) {
        globalPriceHistory.forEach(h => {
            let sym = String(h.symbol || "").toUpperCase().trim();
            if (!sym) return;
            let dStr = h.date;
            if (dStr.includes('T')) dStr = dStr.split('T')[0];
            let p = parseFloat(h.price) || 0;
            if (p > 0) {
                if (!assetPricePoints[sym]) assetPricePoints[sym] = [];
                assetPricePoints[sym].push({ date: new Date(dStr), price: p });
            }
        });
    }
    
    for (let sym in globalMarketData) {
        if (!assetPricePoints[sym]) assetPricePoints[sym] = [];
        assetPricePoints[sym].push({ date: now, price: globalMarketData[sym] });
    }
    for (let sym in assetPricePoints) assetPricePoints[sym].sort((a,b) => a.date - b.date);

    let firstTradeDate = now;
    if (filteredTrades.length > 0) {
        let d = filteredTrades[0].date;
        if(d.includes('T')) d = d.split('T')[0];
        firstTradeDate = new Date(d);
        firstTradeDate.setHours(0,0,0,0);
    }

    let dailyData = { market: {}, cost: {}, realized: {} };
    let currentHoldings = {};
    let tradeIndex = 0;
    let currentDateWalk = new Date(firstTradeDate);
    let cumulativeRealizedPL_THB = 0;

    while (currentDateWalk <= now) {
        let dStrWalk = currentDateWalk.getFullYear() + "-" + String(currentDateWalk.getMonth()+1).padStart(2,'0') + "-" + String(currentDateWalk.getDate()).padStart(2,'0');
        
        while (tradeIndex < filteredTrades.length) {
            let td = filteredTrades[tradeIndex].date;
            if(td.includes('T')) td = td.split('T')[0];
            let tradeDateObj = new Date(td);
            tradeDateObj.setHours(0,0,0,0);
            
            if (tradeDateObj <= currentDateWalk) {
                let trade = filteredTrades[tradeIndex];
                let sym = String(trade.symbol || "").toUpperCase().trim();
                let typeStr = String(trade.type || "").toLowerCase().trim();
                let vol = Math.abs(parseFloat(trade.volume) || 0);
                let price = Math.abs(parseFloat(trade.price) || 0);
                let fee = Math.abs(parseFloat(trade.fee) || 0);
                let totalVal = Math.abs(parseFloat(trade.totalValue) || 0);
                
                let isBuy = typeStr.includes('buy') || typeStr.includes('deposit') || typeStr.includes('ฝาก');
                let isSell = typeStr.includes('sell') || typeStr.includes('withdraw') || typeStr.includes('ถอน');
                let isInterest = typeStr.includes('dividend') || typeStr.includes('interest') || typeStr.includes('ดอกเบี้ย') || typeStr.includes('ปันผล');
                
                let currency = 'USD'; 
                if (trade.portfolio.includes('กองทุน') || trade.portfolio.includes('Funds') || trade.portfolio.includes('คริปโต') || trade.portfolio.includes('Crypto')) currency = 'THB';
                else if (trade.portfolio.includes('เงินสด') || trade.portfolio.includes('Cash')) {
                    if (sym.includes('USD') || sym.includes('FCD')) currency = 'USD';
                    else currency = 'THB';
                }
                
                if (trade.portfolio.includes('เงินสด') || trade.portfolio.includes('Cash') || sym.includes('DIME') || sym.includes('CASH')) {
                    if (totalVal > 0) vol = totalVal;
                    else if (vol > 0 && price > 0) vol = vol * price;
                    price = 1;
                }

                if (!currentHoldings[sym]) currentHoldings[sym] = { volume: 0, totalCostTHB: 0, averageCostTHB: 0, currency: currency, portfolio: trade.portfolio };
                let asset = currentHoldings[sym];
                
                let usdThbAtTrade = globalExchangeRate;
                
                let priceTHB = currency === 'THB' ? price : price * usdThbAtTrade;
                let feeTHB = currency === 'THB' ? fee : fee * usdThbAtTrade;
                
                if (isBuy) {
                    asset.volume += vol;
                    asset.totalCostTHB += (vol * priceTHB) + feeTHB;
                    if (asset.volume > 0) asset.averageCostTHB = asset.totalCostTHB / asset.volume;
                } else if (isSell) {
                    if (asset.volume > 0) {
                        let costBasisRemoved = asset.averageCostTHB * vol;
                        asset.totalCostTHB -= costBasisRemoved;
                        asset.volume -= vol;
                        let saleValueTHB = (vol * priceTHB) - feeTHB;
                        cumulativeRealizedPL_THB += (saleValueTHB - costBasisRemoved);
                    }
                } else if (isInterest) {
                    let proceedsTHB = totalVal > 0 
                        ? (currency === 'THB' ? totalVal : totalVal * usdThbAtTrade)
                        : (vol * priceTHB) - feeTHB;
                    cumulativeRealizedPL_THB += proceedsTHB; 
                    
                    let isCashAsset = trade.portfolio.includes('เงินสด') || trade.portfolio.includes('Cash') || sym.includes('CASH') || sym.includes('DIME');
                    let targetSym = isCashAsset ? sym : "DIME USD";
                    if (!isCashAsset && (trade.portfolio.includes('กองทุน') || trade.portfolio.includes('Funds') || trade.portfolio.includes('คริปโต') || trade.portfolio.includes('Crypto'))) {
                        targetSym = "DIME SAVE";
                    }
                    let targetCurrency = targetSym === "DIME SAVE" ? "THB" : "USD";
                    
                    if (!currentHoldings[targetSym]) {
                        currentHoldings[targetSym] = { volume: 0, totalCostTHB: 0, averageCostTHB: 0, currency: targetCurrency, portfolio: "เงินสด (Cash)" };
                    }
                    let targetAsset = currentHoldings[targetSym];
                    
                    let interestAmtTHB = proceedsTHB; // Add the actual net proceeds THB
                    let addedVolume = targetCurrency === 'THB' ? proceedsTHB : proceedsTHB / globalExchangeRate;
                    
                    targetAsset.volume += addedVolume;
                    targetAsset.totalCostTHB += interestAmtTHB; 
                    if (targetAsset.volume > 0) targetAsset.averageCostTHB = targetAsset.totalCostTHB / targetAsset.volume;
                }
                tradeIndex++;
            } else break;
        }
        
        let dailyValueMarketTHB = 0;
        let dailyValueCostTHB = 0;
        let usdThbToday = globalExchangeRate;
        
        for (let k in currentHoldings) {
            let asset = currentHoldings[k];
            if (asset.volume > 0.0001) {
                dailyValueCostTHB += asset.totalCostTHB;
                if (k === 'CASH' || k === 'USD' || k === 'THB' || k === 'DIME' || k.includes('เงินสด') || asset.portfolio.includes('เงินสด')) {
                    dailyValueMarketTHB += asset.totalCostTHB;
                } else {
                    let interpPrice = getInterpolatedPrice(k, currentDateWalk, assetPricePoints);
                    let priceTHB = asset.currency === 'THB' ? interpPrice : interpPrice * usdThbToday;
                    dailyValueMarketTHB += asset.volume * priceTHB;
                }
            }
        }
        
        dailyData['market'][dStrWalk] = dailyValueMarketTHB;
        dailyData['cost'][dStrWalk] = dailyValueCostTHB;
        dailyData['realized'][dStrWalk] = cumulativeRealizedPL_THB;
        currentDateWalk.setDate(currentDateWalk.getDate() + 1);
    }

    let allDates = Object.keys(dailyData['market']).sort((a,b) => new Date(a) - new Date(b));
    let lastKnownMarket = 0, lastKnownCost = 0, lastKnownActiveCost = 0, lastKnownRealized = 0;
    
    let chartLabels = [], chartDataMarket = [], chartDataCost = [], chartDataActiveCost = [], chartDataRealized = [];
    
    let step = allDates.length > 300 ? 7 : (allDates.length > 90 ? 3 : 1);
    
    let maxWealth = 0;
    let maxProfit = -Infinity;
    let peakMarketForDD = 0;
    let maxDrawdownTHB = 0;
    let maxDrawdownTHB_PctAtTime = 0;
    let maxDrawdownPct = 0;
    let maxDrawdownPct_THBAtTime = 0;
    
    let monthlyMap = {};
    
    for (let i = 0; i < allDates.length; i++) {
        let d = allDates[i];
        let market = dailyData['market'][d];
        let activeCost = dailyData['cost'][d];
        let realized = dailyData['realized'][d];
        let adjustedCost = activeCost - realized;
        let withdrawal = 0;
        if (i > 0) {
            let prevCost = dailyData['cost'][allDates[i-1]];
            withdrawal = Math.max(0, prevCost - activeCost);
        }
        
        if (withdrawal > 0) {
            maxWealth = Math.max(0, maxWealth - withdrawal);
        }
        
        if (market > maxWealth) maxWealth = market;
        let ddTHB = maxWealth - market;
        let ddPct = maxWealth > 0 ? (ddTHB / maxWealth) * 100 : 0;
        
        let ym = d.substring(0, 7);
        if (!monthlyMap[ym]) {
            monthlyMap[ym] = { month: ym, startMarket: market, startCost: adjustedCost, endMarket: market, endCost: adjustedCost };
        } else {
            monthlyMap[ym].endMarket = market;
            monthlyMap[ym].endCost = adjustedCost;
        }

        if (new Date(d) < startDate) {
            lastKnownMarket = market;
            lastKnownCost = adjustedCost;
            lastKnownActiveCost = activeCost;
            lastKnownRealized = realized;
            // Reset max values when moving into the requested timeframe
            maxWealth = market;
            maxProfit = market - adjustedCost;
            peakMarketForDD = market > 0 ? market : 1;
        } else {
            let currentProfit = market - adjustedCost;
            
            if (currentProfit > maxProfit) {
                maxProfit = currentProfit;
                peakMarketForDD = market > 0 ? market : 1; // Prevent division by zero
            }
            
            let ddTHB = maxProfit - currentProfit;
            let ddPct = peakMarketForDD > 0 ? (ddTHB / peakMarketForDD) * 100 : 0;

            if (ddPct > maxDrawdownPct) {
                maxDrawdownPct = ddPct;
                maxDrawdownPct_THBAtTime = ddTHB;
            }
            if (ddTHB > maxDrawdownTHB) {
                maxDrawdownTHB = ddTHB;
                maxDrawdownTHB_PctAtTime = ddPct;
            }
            
            if (i % step === 0 || i === allDates.length - 1) { 
                chartLabels.push(d);
                chartDataMarket.push(market);
                chartDataCost.push(adjustedCost);
                chartDataActiveCost.push(activeCost);
                chartDataRealized.push(realized);
            }
        }
    }
    
    let monthlyPerformance = [];
    let cumulativePL_Pct = 0;
    let months = Object.keys(monthlyMap).sort();
    
    // Force the current month's final data point to match LIVE Pass 1 data
    if (months.length > 0) {
        let currentYm = months[months.length - 1];
        monthlyMap[currentYm].endMarket = totalWealthTHB;
        monthlyMap[currentYm].endCost = (totalCostBasis * globalExchangeRate) - (realizedPL * globalExchangeRate);
    }
    
    months.forEach(m => {
        let md = monthlyMap[m];
        let startTotalPL = md.startMarket - md.startCost;
        let endTotalPL = md.endMarket - md.endCost;
        let monthPL = endTotalPL - startTotalPL;
        
        let addedCost = Math.max(0, md.endCost - md.startCost);
        let denominator = md.startMarket + addedCost;
        let monthPct = denominator > 0 ? (monthPL / denominator) * 100 : 0;
        
        let trueCumulativePct = md.endCost > 0 ? (endTotalPL / md.endCost) * 100 : 0;
        
        monthlyPerformance.push({
             month: m,
             investedTHB: md.endCost,
             marketTHB: md.endMarket,
             plTHB: monthPL,
             plPct: monthPct,
             cumulativePL: endTotalPL,
             cumulativePct: trueCumulativePct
        });
    });
    monthlyPerformance.reverse();
    
    if (chartLabels.length === 0) {
        let todayStr = now.toISOString().split('T')[0];
        chartLabels.push(todayStr);
        chartDataMarket.push(lastKnownMarket);
        chartDataCost.push(lastKnownCost);
        chartDataActiveCost.push(lastKnownActiveCost);
        chartDataRealized.push(lastKnownRealized);
    }
    
    // Force the final data point to perfectly match the LIVE Pass 1 data
    if (chartLabels.length > 0) {
        chartDataMarket[chartDataMarket.length - 1] = totalWealthTHB;
        chartDataActiveCost[chartDataActiveCost.length - 1] = totalCostBasis * globalExchangeRate;
        chartDataRealized[chartDataRealized.length - 1] = realizedPL * globalExchangeRate;
        chartDataCost[chartDataCost.length - 1] = (totalCostBasis * globalExchangeRate) - (realizedPL * globalExchangeRate);
    }
    
    let finalMarket = chartDataMarket.length > 0 ? chartDataMarket[chartDataMarket.length - 1] : 0;
    let finalCost = chartDataCost.length > 0 ? chartDataCost[chartDataCost.length - 1] : 0;
    
    let isAllTime = timeframe === 'ALL' || (allDates.length > 0 && startDate <= new Date(allDates[0]));
    
    let periodPL_Pct = 0;
    let periodPL_THB = 0;
    if (chartDataMarket.length > 0) {
        let startMarket = chartDataMarket[0];
        let endMarket = chartDataMarket[chartDataMarket.length - 1];
        let startCost = chartDataCost[0];
        let endCost = chartDataCost[chartDataCost.length - 1];
        
        if (isAllTime) {
            startMarket = 0;
            startCost = 0;
        }
        
        let approxFlows = endCost - startCost; 
        periodPL_THB = (endMarket - startMarket) - approxFlows; // EXACT period P/L

        if (isAllTime) {
            periodPL_Pct = endCost > 0 ? (periodPL_THB / endCost) * 100 : 0;
        } else {
            let adjustedStart = startMarket + (approxFlows > 0 ? approxFlows / 2 : approxFlows);
            if (adjustedStart > 0) {
                periodPL_Pct = ((endMarket - startMarket - approxFlows) / adjustedStart) * 100;
            } else if (startMarket === 0 && endMarket > 0) {
                periodPL_Pct = approxFlows > 0 ? ((endMarket - approxFlows) / approxFlows) * 100 : 0;
            }
        }
    }

    // Pie chart mapping
    let pieLabels = [];
    let pieData = [];
    for (let key in breakdown) {
        if (breakdown[key] > 0) {
            pieLabels.push(key);
            pieData.push(breakdown[key]);
        }
    }

    return {
        cards: {
            totalWealthTHB, totalWealthUSD,
            totalUnrealizedPL_USD, 
            totalUnrealizedPL_THB, 
            totalUnrealizedPL_Pct,
            totalPL_USD, 
            totalPL_THB, 
            totalPL_Pct,
            maxDrawdownTHB,
            maxDrawdownTHB_PctAtTime,
            maxDrawdownPct,
            maxDrawdownPct_THBAtTime,
            investedCapitalTHB: finalCost
        },
        chart: {
            finalMarketTHB: finalMarket,
            finalMarketUSD: globalExchangeRate > 0 ? finalMarket / globalExchangeRate : 0,
            periodPL_THB,
            periodPL_Pct,
            isAllTime,
            labels: chartLabels,
            marketData: chartDataMarket,
            costData: chartDataCost
        },
        pie: {
            labels: pieLabels,
            data: pieData
        },
        assetList,
        monthlyPerformance
    };
};
