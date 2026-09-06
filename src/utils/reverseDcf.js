export function calculateTerminalAnchoredDcf(params, targetCagr) {
  const { currentPrice, evCurrent, revenueTTM, wacc, terminalG, terminalMargin, forecastYears } = params;

  if (revenueTTM <= 0 || terminalMargin <= 0 || forecastYears <= 0) {
    throw new Error("Invalid Input: Revenue, Margin, and Forecast Years must be positive.");
  }
  
  const r = wacc / 100;
  const g = terminalG / 100;
  const m = terminalMargin / 100;

  if (r <= g) {
    throw new Error("Invalid Input: WACC must be strictly greater than Terminal Growth (g).");
  }

  const futureEV = evCurrent * Math.pow(1 + r, forecastYears);
  const terminalFCFF = futureEV * (r - g);
  const terminalRevenue = terminalFCFF / (m * (1 + g));
  const revenueMultiple = terminalRevenue / revenueTTM;
  const impliedRevenueCAGR = (Math.pow(revenueMultiple, 1 / forecastYears) - 1) * 100;

  let intrinsicEV = 0;
  let intrinsicPrice = 0;
  let priceUpside = 0;

  if (targetCagr !== undefined && targetCagr !== null) {
    const targetRev = revenueTTM * Math.pow(1 + (targetCagr / 100), forecastYears);
    const targetTerminalFCFF = targetRev * m * (1 + g);
    const targetFutureEV = targetTerminalFCFF / (r - g);
    intrinsicEV = targetFutureEV / Math.pow(1 + r, forecastYears);
    
    const cp = parseFloat(currentPrice) || 0;
    const ev = parseFloat(evCurrent) || 0;
    if (cp > 0 && ev > 0) {
      intrinsicPrice = cp * (intrinsicEV / ev);
      priceUpside = ((intrinsicPrice - cp) / cp) * 100;
    }
  }

  return {
    futureEV,
    terminalFCFF,
    terminalRevenue,
    impliedRevenueCAGR,
    intrinsicEV,
    intrinsicPrice,
    priceUpside
  };
}
