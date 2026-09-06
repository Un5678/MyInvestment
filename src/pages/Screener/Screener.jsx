import React, { useState, useEffect } from 'react';
import { evaluateAllBuckets } from '../../utils/scoringEngine';
import { calculateTerminalAnchoredDcf } from '../../utils/reverseDcf';
import { calculateTechnicalConfidence, evaluateExecution, calculateMasterSignal } from '../../utils/technicalEngine';

const InputGroup = ({ label, name, val, onChange, hint, passed }) => (
  <div>
    <label className={`block text-xs font-semibold mb-1 ${passed ? 'text-emerald-600' : 'text-slate-700'}`}>
      {label} {passed && <i className="fa-solid fa-circle-check ml-1"></i>}
    </label>
    <input type="number" step="any" name={name} value={val} onChange={onChange} className={`w-full px-3 py-1.5 rounded-md bg-white border focus:outline-none focus:ring-2 text-sm font-medium shadow-sm transition-all ${passed ? 'border-emerald-400 focus:ring-emerald-500 text-emerald-800' : 'border-slate-300 focus:ring-indigo-500 text-slate-700 hover:border-indigo-400'}`} />
    {hint && <p className="text-[10px] text-slate-400 mt-1 leading-tight"><i className="fa-solid fa-circle-info"></i> {hint}</p>}
  </div>
);

const SelectGroup = ({ label, name, val, onChange, options, passed }) => (
  <div>
    <label className={`block text-xs font-semibold mb-1 ${passed ? 'text-emerald-600' : 'text-slate-700'}`}>
      {label} {passed && <i className="fa-solid fa-circle-check ml-1"></i>}
    </label>
    <select name={name} value={val} onChange={onChange} className={`w-full px-3 py-1.5 rounded-md bg-white border focus:outline-none focus:ring-2 text-sm font-medium shadow-sm ${passed ? 'border-emerald-400 focus:ring-emerald-500 text-emerald-800' : 'border-slate-300 focus:ring-indigo-500 text-slate-700 hover:border-indigo-400'}`}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const SectionCard = ({ title, icon, colorClass, children }) => (
  <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-5 shadow-sm">
    <h3 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${colorClass}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      {title}
    </h3>
    <div className="grid grid-cols-2 gap-5">
      {children}
    </div>
  </div>
);

const ScoreCard = ({ result, bucketName }) => {
  const getVerdictColor = (verdict) => {
    if (verdict === 'APPROVED') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (verdict === 'NEUTRAL') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border-2 flex flex-col md:flex-row items-center justify-between ${getVerdictColor(result.verdict)}`}>
        <div>
          <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">{bucketName} Verdict</p>
          <h3 className="text-2xl font-extrabold">{result.verdict}</h3>
        </div>
        <div className="text-right mt-2 md:mt-0">
          <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Total Score</p>
          <p className="text-3xl font-black">{result.totalScore}<span className="text-lg opacity-50">/100</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Object.entries(result.breakdown).map(([category, data]) => (
          <div key={category} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{category}</p>
            <p className="text-lg font-bold text-slate-800">{data.score} <span className="text-xs text-slate-400">/ {data.maxScore}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Screener = () => {
  const [ticker, setTicker] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    symbol: '',
    quarter: '',
    metrics: { revenueGrowthYoY: '', revenueGrowth5Y: '', epsGrowthTTM: '', epsForward: '', eps3To5YGrowth: '', grossMargin: '', ebitdaMargin: '', fcfMargin: '', roe: '', roic: '', netCashOrDebt: '', currentRatio: '', debtToEquity: '', beta: '', forwardPE: '', pegRatio: '', evToSales: '' },
    benchmarks: { sectorRevenueGrowthYoY: '', industryPE: '', sectorEvToSales: '' }
  });
  const [technicals, setTechnicals] = useState({
    portfolioType: 'CORE',
    sma200: 'Above',
    sma50: 'Above',
    rsi: '',
    macd: 'Bullish',
    bollingerBand: 'Near Upper',
    volume: 'Above_Avg20',
    entryPrice: '',
    targetPrice: '',
    stopLossPrice: '',
    pocPosition: 'Above_POC',
    currentPrice: '', evCurrent: '', revenueTTM: '', wacc: '10', terminalG: '2.5', terminalMargin: '20', forecastYears: '10', revGrowthYoY: '', revGrowth5Y: ''
  });
  const [results, setResults] = useState(null);
  const [techResult, setTechResult] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [dcfResult, setDcfResult] = useState(null);
  const [masterSignalResult, setMasterSignalResult] = useState(null);
  const [error, setError] = useState('');
  const [activeBucket, setActiveBucket] = useState('CORE');
  const [saveStatus, setSaveStatus] = useState('');
  const [history, setHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('');
  const [notes, setNotes] = useState(localStorage.getItem('screenerNotes') || '');

  const handleMetricChange = (e) => setFormData({ ...formData, metrics: { ...formData.metrics, [e.target.name]: e.target.value }});
  const handleBenchmarkChange = (e) => setFormData({ ...formData, benchmarks: { ...formData.benchmarks, [e.target.name]: e.target.value }});

  
  const handleTechChange = (e) => {
    setTechnicals({ ...technicals, [e.target.name]: e.target.value });
  };

  const handleTechSubmit = (e) => {
    e.preventDefault();
    const tResult = calculateTechnicalConfidence(technicals, technicals.portfolioType);
    setTechResult(tResult);
    
    const eResult = evaluateExecution(technicals);
    setExecResult(eResult);

    try {
      if (technicals.currentPrice && technicals.evCurrent && technicals.revenueTTM) {
        const dcfOutput = calculateTerminalAnchoredDcf(technicals);
        const cat = getImpliedGrowthCategory(dcfOutput.impliedRevenueCAGR, technicals.revGrowth5Y, technicals.revGrowthYoY);
        setDcfResult({ ...dcfOutput, category: cat });
        
        let dcfStatus = 'SAFE';
        if (cat === 'Premium') dcfStatus = 'PRICED_FOR_PERFECTION';
        else if (cat === 'Momentum') dcfStatus = 'FAIR';
        
        // Find fundamental score
        let fundScore = 0;
        if (ticker && history && history.length > 0) {
          const latest = history.find(r => r.symbol === ticker);
          if (latest) {
            const pType = technicals.portfolioType || 'CORE';
            if (pType === 'CORE') fundScore = latest.coreScore;
            else if (pType === 'DEFENSIVE') fundScore = latest.defScore;
            else if (pType === 'SATELLITES') fundScore = latest.satScore;
            else if (pType === 'ALPHA') fundScore = latest.alphaScore;
          }
        }

        const masterResult = calculateMasterSignal({
          fundamentalScore: fundScore || 0,
          reverseDcfStatus: dcfStatus,
          technicalScore: tResult.totalScore,
          executionData: { rrRatio: eResult.rrRatio, pocContext: eResult.pocContext },
          portfolioType: technicals.portfolioType
        });
        setMasterSignalResult(masterResult);

      } else {
        setDcfResult(null);
        setMasterSignalResult(null);
      }
    } catch(e) {
      setDcfResult(null);
      setMasterSignalResult(null);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('https://script.google.com/macros/s/AKfycbwnXVzDqzDLUhD6CjEK5jxy0z2UfbvgFM-j8osQ9vTvp_I58aBSBKInaEVAlreFDx7azA/exec?sheetName=ScreenerHistory');
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setHistory(data.data.reverse());
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    localStorage.setItem('screenerNotes', e.target.value);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSaveStatus('Evaluating and Saving...');
    try {
      if (!ticker) throw new Error("Please enter a Ticker Symbol at the top");
      
      // Inject ticker into formData structure for evaluation
      const payloadData = { ...formData, ticker: ticker };
      const multiRes = evaluateAllBuckets(payloadData);
      setResults(multiRes);
      setActiveBucket('CORE');
      
      const payload = {
        sheetName: 'ScreenerHistory',
        date: formData.date,
        quarter: formData.quarter,
        symbol: ticker,
        coreScore: multiRes['CORE'].totalScore,
        defScore: multiRes['DEFENSIVE'].totalScore,
        satScore: multiRes['SATELLITES'].totalScore,
        alphaScore: multiRes['ALPHA'].totalScore
      };

      const response = await fetch('https://script.google.com/macros/s/AKfycbwnXVzDqzDLUhD6CjEK5jxy0z2UfbvgFM-j8osQ9vTvp_I58aBSBKInaEVAlreFDx7azA/exec', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.status === 'success') {
        setSaveStatus('Evaluated and Saved successfully!');
        fetchHistory();
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setError(err.message);
      setSaveStatus('');
    }
  };

  const handleDelete = async (rowIndex) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const payload = {
        action: 'delete',
        sheetName: 'ScreenerHistory',
        rowIndex: rowIndex
      };
      const response = await fetch('https://script.google.com/macros/s/AKfycbwnXVzDqzDLUhD6CjEK5jxy0z2UfbvgFM-j8osQ9vTvp_I58aBSBKInaEVAlreFDx7azA/exec', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.status === 'success') {
        fetchHistory();
      } else {
        alert('Delete failed: ' + result.message);
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const getImpliedGrowthCategory = (implied, rev5y, revYoy) => {
    const i = parseFloat(implied);
    const r5 = parseFloat(rev5y);
    const ry = parseFloat(revYoy);
    if (isNaN(i) || isNaN(r5) || isNaN(ry)) return "N/A";
    if (i <= r5 && i <= ry) return "Undervalued";
    if (i <= r5 && i > ry) return "Discounted";
    if (i > r5 && i <= ry) return "Momentum";
    return "Premium";
  };

  const getDcfColor = (str) => {
    if (!str || str === '-') return 'text-slate-500';
    if (str.includes('Undervalued')) return 'text-emerald-600';
    if (str.includes('Discounted')) return 'text-emerald-500';
    if (str.includes('Momentum')) return 'text-amber-500';
    if (str.includes('Premium')) return 'text-rose-600';
    return 'text-slate-700';
  };

  const getVerdictInfo = (score) => {
    const num = parseFloat(score);
    if (isNaN(num)) return { text: '', color: 'text-slate-700' };
    if (num >= 80) return { text: 'APPROVED', color: 'text-emerald-600' };
    if (num >= 65) return { text: 'NEUTRAL', color: 'text-amber-600' };
    return { text: 'REJECT', color: 'text-rose-600' };
  };

  const getTechBadgeColor = (status) => {
    if (status === 'READY') return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200/50';
    if (status === 'WAIT') return 'bg-amber-500 text-white border-amber-600 shadow-amber-200/50';
    return 'bg-rose-500 text-white border-rose-600 shadow-rose-200/50';
  };

  let latestFundScore = null;
  let fundColor = 'text-slate-400';
  if (ticker && history && history.length > 0) {
    const latest = history.find(r => r.symbol === ticker);
    if (latest) {
      const pType = technicals.portfolioType || 'CORE';
      if (pType === 'CORE') latestFundScore = latest.coreScore;
      else if (pType === 'DEFENSIVE') latestFundScore = latest.defScore;
      else if (pType === 'SATELLITES') latestFundScore = latest.satScore;
      else if (pType === 'ALPHA') latestFundScore = latest.alphaScore;
      
      fundColor = getVerdictInfo(latestFundScore).color;
    }
  }

  return (
    <div className="space-y-8">
      {/* GLOBAL SEARCH BAR */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-2xl">
            <i className="fa-solid fa-magnifying-glass"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Global Ticker</h1>
            <p className="text-xs text-slate-500">Enter symbol once to update all charts and forms.</p>
          </div>
        </div>
        <input 
          type="text" 
          value={ticker} 
          onChange={e => setTicker(e.target.value.toUpperCase())} 
          className="w-full md:w-64 px-5 py-3 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-xl font-black text-center text-slate-800 placeholder-slate-300 transition-all uppercase" 
          placeholder="e.g. AAPL" 
        />
      </div>

      {/* TOP SECTION: TECHNICAL ANALYSIS */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-200 mb-6">
           <i className="fa-solid fa-chart-line text-indigo-500 text-2xl"></i>
           <h2 className="text-2xl font-bold text-slate-800">Technical Analysis (Daily Check)</h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left: Large Chart */}
          <div className="xl:col-span-2">
            {ticker ? (
              <div className="h-[600px] rounded-2xl overflow-hidden shadow-md border-2 border-emerald-200 bg-white ring-4 ring-emerald-50">
                <iframe 
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${ticker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%22STD%3BSMA%22%2C%22STD%3BMACD%22%2C%22STD%3BRSI%22%5D&theme=light&style=1&timezone=Asia%2FBangkok&withdateranges=1&studies_overrides=%7B%7D&preferences=%7B%7D&locale=en`}
                  className="w-full h-full border-0"
                  title="TradingView Chart"
                ></iframe>
              </div>
            ) : (
              <div className="h-[600px] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                <i className="fa-solid fa-chart-column text-6xl mb-4 opacity-50"></i>
                <p className="font-semibold text-lg">Enter a Ticker Symbol to view chart</p>
                <p className="text-sm">Chart will include SMA, MACD, and RSI automatically.</p>
              </div>
            )}
          </div>

          {/* Right: Master Signal Dashboard */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-xl text-slate-800 h-full flex flex-col relative overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

              <h3 className="font-bold text-emerald-900 mb-6 pb-4 border-b border-emerald-200 flex items-center relative z-10">
                <i className="fa-solid fa-bolt text-emerald-500 mr-2"></i> MASTER SIGNAL DASHBOARD
              </h3>
              
              <div className="space-y-4 flex-grow relative z-10">
                {/* 1. Fundamental Component */}
                <div className="bg-white/80 rounded-xl p-4 flex justify-between items-center border border-emerald-100 shadow-sm">
                  <div className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">1. Quality (Fundamentals)</div>
                  <div className={`text-lg font-bold ${latestFundScore ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {latestFundScore ? `${latestFundScore}/100` : '-'}
                  </div>
                </div>

                {/* 2. Valuation Component */}
                <div className="bg-white/80 rounded-xl p-4 flex justify-between items-center border border-emerald-100 shadow-sm">
                  <div className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">2. Valuation (Reverse DCF)</div>
                  <div className={`text-lg font-bold ${dcfResult ? getDcfColor(dcfResult.category) : 'text-slate-400'}`}>
                    {dcfResult ? dcfResult.category : '-'}
                  </div>
                </div>

                {/* 3. Timing Component */}
                <div className="bg-white/80 rounded-xl p-4 flex justify-between items-center border border-emerald-100 shadow-sm">
                  <div className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">3. Timing (Technical)</div>
                  <div className={`text-lg font-bold ${techResult ? (techResult.totalScore >= 65 ? 'text-emerald-600' : 'text-amber-500') : 'text-slate-400'}`}>
                    {techResult ? `${techResult.signal} (${techResult.totalScore})` : '-'}
                  </div>
                </div>

                {/* 4. Execution Component */}
                <div className="bg-white/80 rounded-xl p-4 flex justify-between items-center border border-emerald-100 shadow-sm">
                  <div className="text-xs text-emerald-700 uppercase tracking-wider font-semibold">4. Execution (Risk/Reward)</div>
                  <div className={`text-lg font-bold ${execResult ? (execResult.isWorthTrading ? 'text-emerald-600' : 'text-rose-500') : 'text-slate-400'}`}>
                    {execResult && execResult.isValid ? `${execResult.rrRatio} R:R` : '-'}
                  </div>
                </div>
              </div>

              {/* FINAL ACTION */}
              <div className="mt-8 pt-6 border-t border-emerald-200 relative z-10">
                <div className="text-center text-sm text-emerald-700 mb-3 uppercase tracking-wider font-bold">Recommended Action</div>
                {masterSignalResult ? (
                   <div className={`py-4 px-6 rounded-2xl text-center border-2 ${masterSignalResult.actionSignal === 'BUY' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : masterSignalResult.actionSignal === 'DCA' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_0_15px_rgba(99,102,241,0.15)]' : (masterSignalResult.actionSignal === 'HOLD' || masterSignalResult.actionSignal === 'WATCH') ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border-rose-500 bg-rose-50 text-rose-700 shadow-[0_0_15px_rgba(244,63,94,0.15)]'}`}>
                      <div className="text-3xl font-black mb-1">{masterSignalResult.actionSignal}</div>
                      {masterSignalResult.actionDescription.includes(' (') ? (
                        <>
                          <div className="text-sm font-bold opacity-90">{masterSignalResult.actionDescription.split(' (')[0]}</div>
                          <div className="text-xs font-semibold opacity-75 mt-0.5">({masterSignalResult.actionDescription.split(' (')[1]}</div>
                        </>
                      ) : (
                        <div className="text-sm font-bold opacity-90">{masterSignalResult.actionDescription}</div>
                      )}
                      <div className="text-xs font-bold mt-2 opacity-75">SCORE: {masterSignalResult.totalScore} / 10</div>
                   </div>
                ) : (
                   <div className={`py-4 px-6 rounded-2xl text-center border-2 border-emerald-200 bg-white/50 text-emerald-600/70`}>
                      <div className="text-3xl font-black mb-1">TBD</div>
                      <div className="text-sm font-semibold opacity-90">Calculate signal to view</div>
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM PANELS: Combined Form */}
        <form onSubmit={handleTechSubmit} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm mt-8">
          <h3 className="font-bold text-slate-800 mb-6 pb-4 border-b border-slate-200 text-xl">
            <i className="fa-solid fa-sliders mr-2 text-indigo-500"></i> Signal Calculation Parameters
          </h3>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {/* Left Column: Technical & Reverse DCF Inputs */}
            <div className="space-y-8">
              <div>
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center"><i className="fa-solid fa-chart-line mr-2"></i> Technical Indicators</h4>
                <div className="grid grid-cols-2 gap-4">
                  <SelectGroup label="Portfolio Type" name="portfolioType" val={technicals.portfolioType} onChange={handleTechChange} options={[{value:'CORE',label:'CORE'},{value:'DEFENSIVE',label:'DEFENSIVE'},{value:'SATELLITES',label:'SATELLITES'},{value:'ALPHA',label:'ALPHA'}]} />
                  <SelectGroup label="Price vs SMA 200" name="sma200" val={technicals.sma200} onChange={handleTechChange} options={[{value:'Above',label:'Above (Uptrend)'},{value:'Below',label:'Below (Downtrend)'}]} passed={techResult?.breakdown?.sma200Score > 0} />
                  <SelectGroup label="Price vs SMA 50" name="sma50" val={technicals.sma50} onChange={handleTechChange} options={[{value:'Above',label:'Above (Momentum)'},{value:'Below',label:'Below (Weak)'}]} passed={techResult?.breakdown?.sma50Score > 0} />
                  <SelectGroup label="MACD" name="macd" val={technicals.macd} onChange={handleTechChange} options={[{value:'Bullish',label:'Bullish Cross'},{value:'Bearish',label:'Bearish/Weak'}]} passed={techResult?.breakdown?.macdScore > 0} />
                  <InputGroup label="RSI (14)" name="rsi" val={technicals.rsi} onChange={handleTechChange} passed={techResult?.breakdown?.rsiScore > 0} />
                  <SelectGroup label="Bollinger Bands" name="bollingerBand" val={technicals.bollingerBand} onChange={handleTechChange} options={[{value:'Above Upper',label:'Above Upper'},{value:'Near Upper',label:'Near Upper'},{value:'Above Mid',label:'Above Mid'},{value:'Below Mid',label:'Below Mid'},{value:'Near Lower',label:'Near Lower'},{value:'Below Lower',label:'Below Lower'}]} passed={techResult?.breakdown?.bbScore > 0} />
                  <SelectGroup label="Volume Behavior" name="volume" val={technicals.volume} onChange={handleTechChange} options={[{value:'Above_Avg20',label:'Above Avg 20'},{value:'Below_Avg20',label:'Below Avg 20'}]} passed={techResult?.breakdown?.volumeScore > 0} />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-200">
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center"><i className="fa-solid fa-calculator mr-2"></i> Valuation (Reverse DCF)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Current Price ($)" name="currentPrice" val={technicals.currentPrice} onChange={handleTechChange} />
                  <InputGroup label="Current EV ($M)" name="evCurrent" val={technicals.evCurrent} onChange={handleTechChange} />
                  <InputGroup label="Revenue TTM ($M)" name="revenueTTM" val={technicals.revenueTTM} onChange={handleTechChange} />
                  <InputGroup label="WACC (%)" name="wacc" val={technicals.wacc} onChange={handleTechChange} />
                  <InputGroup label="Terminal G (%)" name="terminalG" val={technicals.terminalG} onChange={handleTechChange} />
                  <InputGroup label="Term Margin (%)" name="terminalMargin" val={technicals.terminalMargin} onChange={handleTechChange} />
                  <InputGroup label="Forecast Years" name="forecastYears" val={technicals.forecastYears} onChange={handleTechChange} />
                  <InputGroup label="Rev Growth YoY (%)" name="revGrowthYoY" val={technicals.revGrowthYoY} onChange={handleTechChange} />
                  <InputGroup label="Rev Growth 5Y (%)" name="revGrowth5Y" val={technicals.revGrowth5Y} onChange={handleTechChange} />
                </div>
              </div>
            </div>

            {/* Right Column: Execution & Results Output */}
            <div className="space-y-8">
              <div>
                <h4 className="font-semibold text-slate-700 mb-4 flex items-center"><i className="fa-solid fa-crosshairs mr-2"></i> Execution Levels (Risk/Reward)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Entry Price" name="entryPrice" val={technicals.entryPrice} onChange={handleTechChange} />
                  <InputGroup label="Target Price (TP)" name="targetPrice" val={technicals.targetPrice} onChange={handleTechChange} />
                  <InputGroup label="Stop Loss (SL)" name="stopLossPrice" val={technicals.stopLossPrice} onChange={handleTechChange} />
                  <SelectGroup label="POC Context" name="pocPosition" val={technicals.pocPosition} onChange={handleTechChange} options={[{value:'Above_POC',label:'Above POC'},{value:'At_POC',label:'At POC'},{value:'Below_POC',label:'Below POC'}]} />
                </div>
              </div>

              {/* Extra Output Panel for DCF & Execution */}
              {(dcfResult || execResult) && (
                <div className="pt-8 border-t border-slate-200 grid grid-cols-1 gap-4">
                  {/* Execution Output */}
                  {execResult && execResult.isValid && (
                    <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <h5 className="font-bold text-slate-800 mb-4 flex items-center">
                        <i className="fa-solid fa-crosshairs mr-2 text-indigo-500"></i> Execution Assessment Detail
                      </h5>
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 mb-3">
                        <span className="text-sm font-semibold text-slate-600">Risk/Reward Ratio:</span>
                        <span className={`text-xl font-black ${execResult.isWorthTrading ? 'text-emerald-600' : 'text-rose-500'}`}>{execResult.rrRatio}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 mb-2">
                        <span className="text-xs font-bold text-emerald-500">TP Upside: {execResult.upside}</span>
                        <span className="text-xs font-bold text-rose-500">SL Downside: {execResult.downside}</span>
                      </div>
                      <div className={`text-sm font-semibold px-2 ${execResult.isWorthTrading ? 'text-emerald-600' : 'text-rose-500'}`}>
                        <i className={`fa-solid ${execResult.isWorthTrading ? 'fa-check-circle' : 'fa-times-circle'} mr-1`}></i> {execResult.worthinessText}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 px-2">
                        {execResult.pocComment}
                      </div>
                    </div>
                  )}

                  {/* DCF Output */}
                  {dcfResult && (
                    <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <h5 className="font-bold text-slate-800 mb-4 flex items-center">
                         <i className="fa-solid fa-chart-pie mr-2 text-indigo-500"></i> Reverse DCF Results
                      </h5>
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="text-sm font-semibold text-slate-600">Implied Growth (Market Expectations):</span>
                          <span className="text-xl font-black text-indigo-600">{dcfResult.impliedRevenueCAGR.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between items-center px-2">
                          <span className="text-xs text-slate-500">vs Revenue YoY Hist ({technicals.revGrowthYoY}%):</span>
                          <span className={`text-xs font-bold ${dcfResult.impliedRevenueCAGR <= parseFloat(technicals.revGrowthYoY) ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {dcfResult.impliedRevenueCAGR <= parseFloat(technicals.revGrowthYoY) ? 'PASS (ตลาดคาดหวังต่ำกว่าปัจจุบัน)' : 'FAIL (ตลาดคาดหวังสูงกว่าปัจจุบัน)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center px-2">
                          <span className="text-xs text-slate-500">vs Revenue 5Y Hist ({technicals.revGrowth5Y}%):</span>
                          <span className={`text-xs font-bold ${dcfResult.impliedRevenueCAGR <= parseFloat(technicals.revGrowth5Y) ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {dcfResult.impliedRevenueCAGR <= parseFloat(technicals.revGrowth5Y) ? 'PASS (ตลาดคาดหวังต่ำกว่าอดีต)' : 'FAIL (ตลาดคาดหวังสูงกว่าอดีต)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition-colors text-lg">
              <i className="fa-solid fa-bolt mr-2"></i> CALCULATE MASTER SIGNAL
            </button>
          </div>
        </form>
      </div>

      {/* BOTTOM SECTION: FUNDAMENTAL ANALYSIS */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 mb-6 gap-4">
           <div className="flex items-center gap-3">
             <i className="fa-solid fa-building-columns text-green-500 text-2xl"></i>
             <h2 className="text-2xl font-bold text-slate-800">Fundamental Analysis (Quarterly)</h2>
           </div>
           {saveStatus && <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg animate-pulse">{saveStatus}</span>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 font-bold shadow-sm" required />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Quarter (e.g. Q2/2026)</label>
              <input type="text" value={formData.quarter} onChange={e => setFormData({...formData, quarter: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 font-bold shadow-sm" placeholder="Q2/2026" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SectionCard title="1. Growth Metrics" icon="fa-arrow-trend-up" colorClass="bg-blue-500">
              <InputGroup label="Rev Growth YoY (%)" name="revenueGrowthYoY" val={formData.metrics.revenueGrowthYoY} onChange={handleMetricChange} hint="Seeking Alpha" />
              <InputGroup label="Rev Growth 5Y (%)" name="revenueGrowth5Y" val={formData.metrics.revenueGrowth5Y} onChange={handleMetricChange} hint="Seeking Alpha" />
              <InputGroup label="EPS Growth TTM (%)" name="epsGrowthTTM" val={formData.metrics.epsGrowthTTM} onChange={handleMetricChange} hint="Seeking Alpha" />
              <InputGroup label="EPS Forward (%)" name="epsForward" val={formData.metrics.epsForward} onChange={handleMetricChange} hint="Seeking Alpha" />
              <InputGroup label="EPS 3-5Y CAGR (%)" name="eps3To5YGrowth" val={formData.metrics.eps3To5YGrowth} onChange={handleMetricChange} hint="Seeking Alpha" />
            </SectionCard>

            <SectionCard title="2. Profitability" icon="fa-sack-dollar" colorClass="bg-amber-500">
              <InputGroup label="Gross Margin (%)" name="grossMargin" val={formData.metrics.grossMargin} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="EBITDA Margin (%)" name="ebitdaMargin" val={formData.metrics.ebitdaMargin} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="FCF Margin (%)" name="fcfMargin" val={formData.metrics.fcfMargin} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="ROE (%)" name="roe" val={formData.metrics.roe} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="ROIC (%)" name="roic" val={formData.metrics.roic} onChange={handleMetricChange} hint="Stock Analysis" />
            </SectionCard>

            <SectionCard title="3. Health" icon="fa-heart-pulse" colorClass="bg-rose-500">
              <InputGroup label="Net Cash/Debt ($M)" name="netCashOrDebt" val={formData.metrics.netCashOrDebt} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="Current Ratio" name="currentRatio" val={formData.metrics.currentRatio} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="Debt/Equity" name="debtToEquity" val={formData.metrics.debtToEquity} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="Beta" name="beta" val={formData.metrics.beta} onChange={handleMetricChange} hint="Stock Analysis" />
            </SectionCard>

            <SectionCard title="4. Valuation" icon="fa-tags" colorClass="bg-purple-500">
              <InputGroup label="Forward P/E" name="forwardPE" val={formData.metrics.forwardPE} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="PEG Ratio" name="pegRatio" val={formData.metrics.pegRatio} onChange={handleMetricChange} hint="Stock Analysis" />
              <InputGroup label="EV/Sales" name="evToSales" val={formData.metrics.evToSales} onChange={handleMetricChange} hint="Stock Analysis" />
            </SectionCard>

            <SectionCard title="5. Sector Benchmarks" icon="fa-industry" colorClass="bg-indigo-500">
              <InputGroup label="Sector Rev YoY (%)" name="sectorRevenueGrowthYoY" val={formData.benchmarks.sectorRevenueGrowthYoY} onChange={handleBenchmarkChange} hint="Seeking Alpha" />
              <InputGroup label="Industry P/E" name="industryPE" val={formData.benchmarks.industryPE} onChange={handleBenchmarkChange} hint="Stock Analysis" />
              <InputGroup label="Sector EV/Sales" name="sectorEvToSales" val={formData.benchmarks.sectorEvToSales} onChange={handleBenchmarkChange} hint="Seeking Alpha" />
            </SectionCard>
          </div>

          {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-semibold border border-rose-200"><i className="fa-solid fa-triangle-exclamation mr-2"></i>{error}</div>}

          <button type="submit" className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl shadow-lg transition-all text-xl mt-8">
            Evaluate Fundamentals & Save Record
          </button>
        </form>

        {/* Fundamental Results Container */}
        {results && (
          <div className="mt-10 pt-8 border-t border-slate-200 animate-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-slate-800">
                Evaluation Results for <span className="text-indigo-600 px-3 py-1 bg-indigo-50 rounded-lg">{ticker}</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {['CORE', 'DEFENSIVE', 'SATELLITES', 'ALPHA'].map(bucket => (
                <button 
                  key={bucket} 
                  onClick={() => setActiveBucket(bucket)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all ${activeBucket === bucket ? 'border-indigo-500 ring-4 ring-indigo-500/20 bg-white scale-105 shadow-md' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'}`}
                >
                  <p className="text-xs font-bold text-slate-500 mb-1">{bucket}</p>
                  <p className={`text-3xl font-black ${results[bucket].verdict === 'APPROVED' ? 'text-emerald-600' : results[bucket].verdict === 'NEUTRAL' ? 'text-amber-600' : 'text-rose-600'}`}>
                    {results[bucket].totalScore}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{results[bucket].verdict}</p>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-2">
              <ScoreCard result={results[activeBucket]} bucketName={activeBucket} />
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: HISTORY TABLE */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800"><i className="fa-solid fa-clock-rotate-left text-slate-400 mr-2"></i>Screening History</h2>
          <div className="relative mt-3 sm:mt-0 w-full sm:w-auto">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input type="text" placeholder="Search Ticker..." value={historyFilter} onChange={e => setHistoryFilter(e.target.value)} className="w-full sm:w-64 pl-9 pr-4 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Quarter</th>
                <th className="px-5 py-4">Ticker</th>
                <th className="px-5 py-4 text-center">Core</th>
                <th className="px-5 py-4 text-center">Defensive</th>
                <th className="px-5 py-4 text-center">Satellites</th>
                <th className="px-5 py-4 text-center">Alpha</th>

                <th className="px-5 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-slate-400">No history found. Save an evaluation to see it here.</td></tr>
              ) : (
                history.filter(row => row.symbol && row.symbol.toLowerCase().includes(historyFilter.toLowerCase())).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-600">{row.date ? row.date.split('T')[0] : ''}</td>
                    <td className="px-5 py-4 text-slate-500">{row.quarter || '-'}</td>
                    <td className="px-5 py-4 font-black text-indigo-600 text-base">{row.symbol}</td>
                    <td className="px-5 py-2 text-center">
                      <div className={`font-black text-lg ${getVerdictInfo(row.coreScore).color}`}>{row.coreScore}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{getVerdictInfo(row.coreScore).text}</div>
                    </td>
                    <td className="px-5 py-2 text-center">
                      <div className={`font-black text-lg ${getVerdictInfo(row.defScore).color}`}>{row.defScore}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{getVerdictInfo(row.defScore).text}</div>
                    </td>
                    <td className="px-5 py-2 text-center">
                      <div className={`font-black text-lg ${getVerdictInfo(row.satScore).color}`}>{row.satScore}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{getVerdictInfo(row.satScore).text}</div>
                    </td>
                    <td className="px-5 py-2 text-center">
                      <div className={`font-black text-lg ${getVerdictInfo(row.alphaScore).color}`}>{row.alphaScore}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{getVerdictInfo(row.alphaScore).text}</div>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button onClick={() => handleDelete(row.rowIndex)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors" title="Delete">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Screener;
