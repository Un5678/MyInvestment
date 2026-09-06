export function calculateTechnicalConfidence(inputs, portfolioType = 'CORE') {
  const type = portfolioType.toUpperCase();
  const breakdown = {
    sma200Score: 0,
    sma50Score: 0,
    macdScore: 0,
    rsiScore: 0,
    bbScore: 0,
    volumeScore: 0,
  };

  if (inputs.sma200 === 'Above') breakdown.sma200Score = 15;
  if (inputs.sma50 === 'Above') breakdown.sma50Score = 15;
  if (inputs.macd === 'Bullish') breakdown.macdScore = 15;

  const rsi = Number(inputs.rsi);
  if (!isNaN(rsi)) {
    if (type === 'ALPHA') {
      if (rsi >= 60 && rsi <= 75) breakdown.rsiScore = 20;
      else if (rsi >= 50 && rsi < 60) breakdown.rsiScore = 12;
      else if (rsi > 75) breakdown.rsiScore = 8;
      else breakdown.rsiScore = 0;
    } else {
      if (rsi >= 45 && rsi <= 65) breakdown.rsiScore = 20;
      else if (rsi >= 30 && rsi < 45) breakdown.rsiScore = 12;
      else if (rsi > 65 && rsi <= 75) breakdown.rsiScore = 5;
      else breakdown.rsiScore = 0;
    }
  }

  switch (inputs.bollingerBand) {
    case 'Near Upper':
      breakdown.bbScore = (type === 'ALPHA' || type === 'SATELLITES') ? 20 : 15;
      break;
    case 'Above Mid':
      breakdown.bbScore = (type === 'CORE' || type === 'DEFENSIVE') ? 20 : 15;
      break;
    case 'Near Lower':
      breakdown.bbScore = (type === 'DEFENSIVE') ? 12 : (type === 'CORE' ? 8 : 0);
      break;
    case 'Above Upper':
    case 'Below Mid':
      breakdown.bbScore = 5;
      break;
    case 'Below Lower':
    default:
      breakdown.bbScore = 0;
      break;
  }

  if (inputs.volume === 'Above_Avg20') {
    breakdown.volumeScore = 15;
  } else {
    breakdown.volumeScore = 0;
  }

  const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  let signal = 'WAIT';
  if (totalScore >= 80) signal = 'STRONG';
  else if (totalScore >= 65) signal = 'ACCUM';

  return { totalScore, breakdown, signal };
}

export function evaluateExecution({ entryPrice, targetPrice, stopLossPrice, pocPosition }) {
  const entry = Number(entryPrice);
  const target = Number(targetPrice);
  const stopLoss = Number(stopLossPrice);

  if (!entry || !target || !stopLoss || target <= entry || stopLoss >= entry) {
    return {
      isValid: false,
      message: 'Invalid price levels',
    };
  }

  const reward = target - entry;
  const risk = entry - stopLoss;
  const rrRatio = Number((reward / risk).toFixed(2));
  const upsidePercent = Number(((reward / entry) * 100).toFixed(2));
  const downsidePercent = Number(((risk / entry) * 100).toFixed(2));

  let worthiness = 'NOT_WORTH';
  let worthinessText = 'ไม่คุ้มเสี่ยง (Risk > Reward)';
  
  if (rrRatio >= 2.5) {
    worthiness = 'HIGHLY_WORTH';
    worthinessText = 'คุ้มค่ามาก (Excellent R:R)';
  } else if (rrRatio >= 2.0) {
    worthiness = 'ACCEPTABLE';
    worthinessText = 'คุ้มค่าน่าสนใจ (Good R:R)';
  } else if (rrRatio >= 1.5) {
    worthiness = 'FAIR';
    worthinessText = 'ความคุ้มค่าปานกลาง (Fair R:R)';
  }

  let pocComment = '';
  switch (pocPosition) {
    case 'Above_POC':
      pocComment = 'ราคาอยู่เหนือ POC: ต้นทุนได้เปรียบ ไม่มีดอยขวาง';
      break;
    case 'At_POC':
      pocComment = 'ราคาย่อแตะ POC: จุดรับของสถาบัน';
      break;
    case 'Below_POC':
      pocComment = 'ราคาอยู่ใต้ POC: ระวังแรงขายติดดอย';
      break;
    default:
      pocComment = 'ไม่มีข้อมูล POC';
  }

  return {
    isValid: true,
    rrRatio,
    upside: `+${upsidePercent}%`,
    downside: `-${downsidePercent}%`,
    isWorthTrading: rrRatio >= 2.0,
    worthiness,
    worthinessText,
    pocContext: pocPosition,
    pocComment,
  };
}

/**
 * คำนวณ Master Signal 10 คะแนนเต็ม (อัปเดตน้ำหนักและชื่อสัญญาณ)
 * 
 * @param {Object} params
 * @param {number} params.fundamentalScore - คะแนนพื้นฐาน (0-100)
 * @param {string} params.reverseDcfStatus - 'SAFE' | 'FAIR' | 'PRICED_FOR_PERFECTION'
 * @param {number} params.technicalScore - คะแนนเทคนิคอล (0-100)
 * @param {Object} params.executionData - { rrRatio, pocContext }
 * @param {string} portfolioType - 'CORE' | 'DEFENSIVE' | 'SATELLITES' | 'ALPHA'
 */
export function calculateMasterSignal({
  fundamentalScore = 0,
  reverseDcfStatus = 'SAFE',
  technicalScore = 0,
  executionData = {},
  portfolioType = 'CORE'
}) {
  const type = portfolioType.toUpperCase();

  // กำหนดน้ำหนักใหม่ตามการปรับเกลี่ย
  const weightsConfig = {
    CORE: { fund: 4.0, dcf: 3.5, tech: 2.0, exec: 0.5 },
    DEFENSIVE: { fund: 4.5, dcf: 3.5, tech: 1.5, exec: 0.5 },
    SATELLITES: { fund: 3.0, dcf: 2.5, tech: 2.5, exec: 2.0 },
    ALPHA: { fund: 1.5, dcf: 1.0, tech: 5.0, exec: 2.5 },
  };

  const weights = weightsConfig[type] || weightsConfig.CORE;

  // 1. Fundamental Points
  const fundPoints = (Math.min(fundamentalScore, 100) / 100) * weights.fund;

  // 2. Reverse DCF Points
  let dcfMultiplier = 0;
  if (reverseDcfStatus === 'SAFE') dcfMultiplier = 1.0;
  else if (reverseDcfStatus === 'FAIR') dcfMultiplier = 0.7;
  else dcfMultiplier = 0;
  const dcfPoints = dcfMultiplier * weights.dcf;

  // 3. Technical Points
  const techPoints = (Math.min(technicalScore, 100) / 100) * weights.tech;

  // 4. Execution Points (R:R & POC)
  const rr = executionData.rrRatio || 0;
  const isPocGood = executionData.pocContext === 'Above_POC' || executionData.pocContext === 'At_POC';
  
  let execMultiplier = 0;
  if (rr >= 2.5 && isPocGood) execMultiplier = 1.0;
  else if (rr >= 2.0) execMultiplier = isPocGood ? 0.85 : 0.65;
  else if (rr >= 1.5) execMultiplier = 0.4;
  else execMultiplier = 0;

  const execPoints = execMultiplier * weights.exec;

  // รวมคะแนนทั้งหมด (10 แต้มเต็ม)
  const totalScore = Number((fundPoints + dcfPoints + techPoints + execPoints).toFixed(2));

  // แปลผลสัญญาณเฉพาะรายพอร์ต
  let actionSignal = 'HOLD';
  let actionDescription = '';

  if (type === 'CORE' || type === 'DEFENSIVE') {
    if (totalScore >= 8.5) {
      actionSignal = 'BUY';
      actionDescription = 'จุดเข้าซื้อคุณภาพสูงที่ไม่ควรพลาด (ของดีราคาถูก)';
    } else if (totalScore >= 6.5) {
      actionSignal = 'DCA';
      actionDescription = 'โซนราคาเหมาะสมสำหรับการทยอย DCA';
    } else {
      actionSignal = 'HOLD';
      actionDescription = 'ถือครองตามปกติ ยังไม่ใช่จังหวะเติมเงินเพิ่ม';
    }
  } else if (type === 'SATELLITES') {
    if (totalScore >= 8.5) {
      actionSignal = 'BUY';
      actionDescription = 'สัญญาณซื้อพร้อมรันการเติบโตรอบใหม่';
    } else if (totalScore >= 7.0) {
      actionSignal = 'DCA';
      actionDescription = 'ทยอยสะสมตามแนวโน้มการเติบโต';
    } else if (totalScore >= 5.5) {
      actionSignal = 'WATCH';
      actionDescription = 'ติดตามใน Watchlist รอยืนยันสัญญาณเทคนิคอล';
    } else {
      actionSignal = 'HOLD';
      actionDescription = 'ถือตามรอบเดิม ยังไม่เปิดไม้เพิ่ม';
    }
  } else if (type === 'ALPHA') {
    if (totalScore >= 8.5) {
      actionSignal = 'BUY';
      actionDescription = 'Setup คมชัด โมเมนตัมพร้อมระเบิด R:R คุ้มค่า';
    } else if (totalScore >= 6.5) {
      actionSignal = 'WATCH';
      actionDescription = 'กราฟเริ่มเซ็ตตัว ดักรอจังหวะ Breakout';
    } else if (totalScore >= 5.0) {
      actionSignal = 'HOLD';
      actionDescription = 'มีสถานะเดิมให้รันเทรนด์ต่อตาม Trailing Stop';
    } else {
      actionSignal = 'AVOID';
      actionDescription = 'หลีกเลี่ยงการเข้าซื้อ (ความเสี่ยงสูง / ขาดแรงส่ง)';
    }
  }

  return {
    portfolioType: type,
    totalScore,
    maxScore: 10,
    actionSignal,
    actionDescription,
    breakdown: {
      fundamental: Number(fundPoints.toFixed(2)),
      reverseDcf: Number(dcfPoints.toFixed(2)),
      technical: Number(techPoints.toFixed(2)),
      execution: Number(execPoints.toFixed(2)),
    },
  };
}
