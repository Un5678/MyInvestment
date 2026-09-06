import { calculateTerminalAnchoredDcf } from './reverseDcf';

export function evaluateAllBuckets(payload) {
  const buckets = ['CORE', 'DEFENSIVE', 'SATELLITES', 'ALPHA'];
  const results = {};
  buckets.forEach(bucket => {
    results[bucket] = evaluateStock({ ...payload, bucket });
  });
  return results;
}

export function evaluateStock(payload) {
  const { bucket, metrics, benchmarks } = payload;

  let growthScore = 0;
  let profScore = 0;
  let healthScore = 0;
  let valScore = 0;

  const growthPass = {};
  const profPass = {};
  const healthPass = {};
  const valPass = {};

  if (bucket === 'CORE') {
    growthPass.revYoY = metrics.revenueGrowthYoY >= 10 || metrics.revenueGrowthYoY > benchmarks.sectorRevenueGrowthYoY;
    if (growthPass.revYoY) growthScore += 5;

    growthPass.rev5Y = metrics.revenueGrowth5Y >= 10;
    if (growthPass.rev5Y) growthScore += 7;

    growthPass.epsTTM = metrics.epsGrowthTTM >= 10;
    if (growthPass.epsTTM) growthScore += 3;

    growthPass.epsFwd = metrics.epsForward >= metrics.epsGrowthTTM;
    if (growthPass.epsFwd) growthScore += 3;

    growthPass.epsCAGR = metrics.eps3To5YGrowth >= 12;
    if (growthPass.epsCAGR) growthScore += 7;

    profPass.grossMargin = metrics.grossMargin >= 50;
    if (profPass.grossMargin) profScore += 8;

    profPass.ebitdaMargin = metrics.ebitdaMargin >= 25;
    if (profPass.ebitdaMargin) profScore += 3;

    profPass.fcfMargin = metrics.fcfMargin >= 15;
    if (profPass.fcfMargin) profScore += 10;

    profPass.roe = metrics.roe >= 15;
    if (profPass.roe) profScore += 4;

    profPass.roic = metrics.roic >= 15;
    if (profPass.roic) profScore += 15;

    healthPass.netCash = metrics.netCashOrDebt > 0 || (metrics.debtToEquity <= 0.8 && metrics.currentRatio >= 1.3);
    if (healthPass.netCash) healthScore += 8;

    healthPass.currentRatio = metrics.currentRatio >= 1.5;
    if (healthPass.currentRatio) healthScore += 4;

    healthPass.debtToEquity = metrics.debtToEquity <= 0.8;
    if (healthPass.debtToEquity) healthScore += 4;

    healthPass.beta = metrics.beta <= 1.3;
    if (healthPass.beta) healthScore += 4;

    valPass.forwardPE = metrics.forwardPE <= benchmarks.industryPE*1.15;
    if (valPass.forwardPE) valScore += 8;

    valPass.pegRatio = metrics.pegRatio <= 1.8;
    if (valPass.pegRatio) valScore += 7;

    valPass.evToSales = metrics.evToSales <= benchmarks.sectorEvToSales;
    if (valPass.evToSales) valScore += 0;

    // Reverse DCF removed from scoring per user request
  }
  else if (bucket === 'DEFENSIVE') {
    growthPass.revYoY = metrics.revenueGrowthYoY >= 5 || metrics.revenueGrowthYoY > benchmarks.sectorRevenueGrowthYoY;
    if (growthPass.revYoY) growthScore += 3;
    growthPass.rev5Y = metrics.revenueGrowth5Y >= 5;
    if (growthPass.rev5Y) growthScore += 3;
    growthPass.epsTTM = metrics.epsGrowthTTM >= 5;
    if (growthPass.epsTTM) growthScore += 3;
    growthPass.epsFwd = metrics.epsForward >= metrics.epsGrowthTTM;
    if (growthPass.epsFwd) growthScore += 3;
    growthPass.epsCAGR = metrics.eps3To5YGrowth >= 5;
    if (growthPass.epsCAGR) growthScore += 3;

    profPass.grossMargin = metrics.grossMargin >= 45;
    if (profPass.grossMargin) profScore += 6;
    profPass.ebitdaMargin = metrics.ebitdaMargin >= 25;
    if (profPass.ebitdaMargin) profScore += 7;
    profPass.fcfMargin = metrics.fcfMargin >= 15;
    if (profPass.fcfMargin) profScore += 10;
    profPass.roe = metrics.roe >= 12;
    if (profPass.roe) profScore += 5;
    profPass.roic = metrics.roic >= 10;
    if (profPass.roic) profScore += 7;

    healthPass.netCash = metrics.netCashOrDebt >= 0 || metrics.debtToEquity <= 1.0;
    if (healthPass.netCash) healthScore += 8;
    healthPass.currentRatio = metrics.currentRatio >= 1.3;
    if (healthPass.currentRatio) healthScore += 5;
    healthPass.debtToEquity = metrics.debtToEquity <= 0.8;
    if (healthPass.debtToEquity) healthScore += 7;
    healthPass.beta = metrics.beta <= 0.8;
    if (healthPass.beta) healthScore += 10;

    valPass.forwardPE = metrics.forwardPE <= benchmarks.industryPE;
    if (valPass.forwardPE) valScore += 10;
    valPass.pegRatio = metrics.pegRatio <= 2.0;
    if (valPass.pegRatio) valScore += 5;
    valPass.evToSales = metrics.evToSales <= benchmarks.sectorEvToSales;
    if (valPass.evToSales) valScore += 5;
    // Reverse DCF removed from scoring per user request
  }
  else if (bucket === 'SATELLITES') {
    growthPass.revYoY = metrics.revenueGrowthYoY >= 20;
    if (growthPass.revYoY) growthScore += 12;
    growthPass.rev5Y = metrics.revenueGrowth5Y >= 20;
    if (growthPass.rev5Y) growthScore += 6;
    growthPass.epsTTM = metrics.epsGrowthTTM >= 15;
    if (growthPass.epsTTM) growthScore += 5;
    growthPass.epsFwd = metrics.epsForward > 0;
    if (growthPass.epsFwd) growthScore += 4;
    growthPass.epsCAGR = metrics.eps3To5YGrowth >= 20;
    if (growthPass.epsCAGR) growthScore += 8;

    profPass.grossMargin = metrics.grossMargin >= 60;
    if (profPass.grossMargin) profScore += 10;
    profPass.ebitdaMargin = metrics.ebitdaMargin >= 15;
    if (profPass.ebitdaMargin) profScore += 3;
    profPass.fcfMargin = metrics.fcfMargin >= 10;
    if (profPass.fcfMargin) profScore += 3;
    profPass.roe = metrics.roe >= 15;
    if (profPass.roe) profScore += 2;
    profPass.roic = metrics.roic >= 12;
    if (profPass.roic) profScore += 2;

    healthPass.netCash = metrics.netCashOrDebt > 0;
    if (healthPass.netCash) healthScore += 8;
    healthPass.currentRatio = metrics.currentRatio >= 1.5;
    if (healthPass.currentRatio) healthScore += 3;
    healthPass.debtToEquity = metrics.debtToEquity <= 0.5;
    if (healthPass.debtToEquity) healthScore += 2;
    healthPass.beta = metrics.beta >= 1.2 && metrics.beta <= 1.8;
    if (healthPass.beta) healthScore += 2;

    valPass.forwardPE = metrics.forwardPE <= benchmarks.industryPE * 1.5;
    if (valPass.forwardPE) valScore += 10;
    valPass.pegRatio = metrics.pegRatio <= 2.0;
    if (valPass.pegRatio) valScore += 10;
    valPass.evToSales = metrics.evToSales <= benchmarks.sectorEvToSales || metrics.evToSales <= 15;
    if (valPass.evToSales) valScore += 10;
    // Reverse DCF removed from scoring per user request
  }
  else if (bucket === 'ALPHA') {
    growthPass.revYoY = metrics.revenueGrowthYoY >= 30;
    if (growthPass.revYoY) growthScore += 20;
    growthPass.rev5Y = true;
    growthScore += 5;
    growthPass.epsTTM = true;
    growthScore += 5;
    growthPass.epsFwd = true;
    growthScore += 5;
    growthPass.epsCAGR = metrics.eps3To5YGrowth >= 25;
    if (growthPass.epsCAGR) growthScore += 10;

    profPass.grossMargin = metrics.grossMargin >= 40;
    if (profPass.grossMargin) profScore += 10;

    healthPass.netCash = metrics.netCashOrDebt > 0;
    if (healthPass.netCash) healthScore += 10;
    healthPass.currentRatio = metrics.currentRatio >= 2.0;
    if (healthPass.currentRatio) healthScore += 5;

    valPass.pegRatio = metrics.pegRatio <= 2.5;
    if (valPass.pegRatio) valScore += 15;
    valPass.evToSales = metrics.evToSales <= 20;
    if (valPass.evToSales) valScore += 15;
    // Reverse DCF removed from scoring per user request
  }

  const totalScore = growthScore + profScore + healthScore + valScore;

  let verdict = 'REJECT';
  if (totalScore >= 80) verdict = 'APPROVED';
  else if (totalScore >= 65) verdict = 'NEUTRAL';

  return {
    ticker: payload.ticker,
    bucket,
    totalScore,
    verdict,
    breakdown: {
      growth: { score: growthScore, maxScore: bucket === 'ALPHA' ? 45 : bucket === 'SATELLITES' ? 35 : bucket === 'CORE' ? 25 : 15, passDetails: growthPass },
      profitability: { score: profScore, maxScore: bucket === 'CORE' ? 40 : bucket === 'DEFENSIVE' ? 35 : bucket === 'SATELLITES' ? 20 : 10, passDetails: profPass },
      health: { score: healthScore, maxScore: bucket === 'DEFENSIVE' ? 30 : bucket === 'CORE' ? 20 : 15, passDetails: healthPass },
      valuation: { score: valScore, maxScore: bucket === 'SATELLITES' || bucket === 'ALPHA' ? 30 : bucket === 'DEFENSIVE' ? 20 : 15, passDetails: valPass },
    }
  };
}
