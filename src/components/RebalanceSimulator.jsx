import React, { useState, useMemo, useEffect } from 'react';

const CATEGORIES = [
  { id: 'หุ้น (Stocks)', label: 'หุ้น (Stocks)', portfolios: ['Core Portfolio', 'Satellite Portfolio', 'Defensive Portfolio', 'Dividend Portfolio', 'Alpha Portfolio'] },
  { id: 'กองทุน (Funds)', label: 'กองทุน (Funds)', portfolios: ['กองทุน (Funds)'] },
  { id: 'ทองคำ (Gold)', label: 'ทองคำ (Gold)', portfolios: ['ทองคำ (Gold)'] },
  { id: 'คริปโต (Crypto)', label: 'คริปโต (Crypto)', portfolios: ['คริปโต (Crypto)'] },
  { id: 'เงินสด (Cash)', label: 'เงินสด (Cash)', portfolios: ['เงินสด (Cash)'] },
];

const RebalanceSimulator = ({ isOpen, onClose, data, dashboardStats }) => {
  const [targets, setTargets] = useState({});
  const [adjustments, setAdjustments] = useState({}); // { assetName: amount_in_THB }
  const [newCash, setNewCash] = useState('');
  const [newAssets, setNewAssets] = useState([]); // [{ name: '', category: '', portfolio: '' }]
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [addAssetForm, setAddAssetForm] = useState({ name: '', category: 'หุ้น (Stocks)', portfolio: 'Core Portfolio' });

  // Load states from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedTargets = localStorage.getItem('rebalance_targets');
      if (savedTargets) setTargets(JSON.parse(savedTargets));

      const savedAdj = localStorage.getItem('rebalance_adjustments');
      if (savedAdj) setAdjustments(JSON.parse(savedAdj));

      const savedCash = localStorage.getItem('rebalance_newCash');
      if (savedCash) setNewCash(savedCash);

      const savedAssets = localStorage.getItem('rebalance_newAssets');
      if (savedAssets) setNewAssets(JSON.parse(savedAssets));
    }
  }, [isOpen]);

  // Save targets to localStorage whenever they change
  const handleTargetChange = (key, value) => {
    const newTargets = { ...targets, [key]: value };
    setTargets(newTargets);
    localStorage.setItem('rebalance_targets', JSON.stringify(newTargets));
  };

  const handleAdjustmentChange = (assetName, valueStr) => {
    const val = parseFloat(valueStr);
    const newAdj = { ...adjustments, [assetName]: isNaN(val) ? '' : val };
    setAdjustments(newAdj);
    localStorage.setItem('rebalance_adjustments', JSON.stringify(newAdj));
  };

  const handleNewCashChange = (val) => {
    setNewCash(val);
    localStorage.setItem('rebalance_newCash', val);
  };

  const handleAddNewAsset = () => {
    if (!addAssetForm.name) return;
    const updated = [...newAssets, addAssetForm];
    setNewAssets(updated);
    localStorage.setItem('rebalance_newAssets', JSON.stringify(updated));
    setShowAddAsset(false);
    setAddAssetForm({ name: '', category: 'หุ้น (Stocks)', portfolio: 'Core Portfolio' });
  };

  const handleRemoveAsset = (assetName) => {
    const updated = newAssets.filter(a => a.name !== assetName);
    setNewAssets(updated);
    localStorage.setItem('rebalance_newAssets', JSON.stringify(updated));
    
    // Also remove targets and adjustments for this asset
    const newTargets = { ...targets };
    delete newTargets[`asset_${assetName}`];
    setTargets(newTargets);
    localStorage.setItem('rebalance_targets', JSON.stringify(newTargets));

    const newAdj = { ...adjustments };
    delete newAdj[assetName];
    setAdjustments(newAdj);
    localStorage.setItem('rebalance_adjustments', JSON.stringify(newAdj));
  };

  // Process holdings into a flat, enriched list
  const baseAssets = useMemo(() => {
    if (!dashboardStats?.holdings) return [];
    
    let list = [];
    const exRate = data?.globalExchangeRate || 34;

    // 1. Process existing holdings
    Object.keys(dashboardStats.holdings).forEach(portName => {
      const portHoldings = dashboardStats.holdings[portName];
      let catId = 'เงินสด (Cash)'; // fallback
      CATEGORIES.forEach(cat => {
        if (cat.portfolios.includes(portName)) catId = cat.id;
      });

      Object.keys(portHoldings).forEach(sym => {
        const item = portHoldings[sym];
        const vol = item.vol || item.volume || 0;
        if (vol <= 0.0001) return;

        let isCash = sym.includes('CASH') || portName.includes('เงินสด') || sym.includes('DIME');
        let isTHB = item.baseCurrency === 'THB';
        
        let valueTHB = 0;
        if (isCash) {
           valueTHB = isTHB ? (item.totalCostBase || 0) : (item.totalCostBase || 0) * exRate;
        } else {
           let currentPrice = (data?.marketMap && data.marketMap[sym] !== undefined) 
                              ? data.marketMap[sym] 
                              : (item.averageCost || 0);
           let valueNative = vol * currentPrice;
           valueTHB = isTHB ? valueNative : valueNative * exRate;
        }

        list.push({
          name: sym,
          portfolio: portName,
          category: catId,
          currentValueTHB: valueTHB,
          isNew: false
        });
      });
    });

    // 2. Add new dummy assets
    newAssets.forEach(na => {
      list.push({
        name: na.name,
        portfolio: na.portfolio,
        category: na.category,
        currentValueTHB: 0,
        isNew: true
      });
    });

    // Sort by value desc
    list.sort((a,b) => b.currentValueTHB - a.currentValueTHB);

    return list;
  }, [data, dashboardStats, newAssets]);

  // Compute Aggregates
  const stats = useMemo(() => {
    let currentTotalWealth = 0;
    baseAssets.forEach(asset => currentTotalWealth += asset.currentValueTHB);
    
    const targetTotalWealth = currentTotalWealth + (parseFloat(newCash) || 0);
    let simTotalWealth = 0;
    
    let currentCatTotals = {};
    let simCatTotals = {};
    let currentPortTotals = {};
    let simPortTotals = {};

    CATEGORIES.forEach(c => {
      currentCatTotals[c.id] = 0;
      simCatTotals[c.id] = 0;
      c.portfolios.forEach(p => {
         currentPortTotals[p] = 0;
         simPortTotals[p] = 0;
      });
    });

    baseAssets.forEach(asset => {
      // Manual adjustment applies to the simulated value
      const adj = parseFloat(adjustments[asset.name]) || 0;
      const simVal = asset.currentValueTHB + adj;
      
      simTotalWealth += simVal;

      if (currentCatTotals[asset.category] !== undefined) {
        currentCatTotals[asset.category] += asset.currentValueTHB;
        simCatTotals[asset.category] += simVal;
      }
      if (currentPortTotals[asset.portfolio] !== undefined) {
         currentPortTotals[asset.portfolio] += asset.currentValueTHB;
         simPortTotals[asset.portfolio] += simVal;
      }
    });

    return {
      currentTotalWealth,
      targetTotalWealth,
      simTotalWealth,
      currentCatTotals,
      simCatTotals,
      currentPortTotals,
      simPortTotals
    };
  }, [baseAssets, adjustments, newCash]);

  const sumCatTargets = CATEGORIES.reduce((sum, c) => sum + (parseFloat(targets[`cat_${c.id}`]) || 0), 0);
  const stockAssets = baseAssets.filter(a => a.category === 'หุ้น (Stocks)');
  const sumStockTargets = stockAssets.reduce((sum, a) => sum + (parseFloat(targets[`asset_${a.name}`]) || 0), 0);

  let totalManualBuy = 0;
  let totalManualSell = 0;
  Object.values(adjustments).forEach(val => {
     const num = parseFloat(val) || 0;
     if (num > 0) totalManualBuy += num;
     if (num < 0) totalManualSell += Math.abs(num);
  });
  const netManual = totalManualBuy - totalManualSell;

  if (!isOpen) return null;

  const formatThb = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden animate-fade-in-up border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-scale-balanced text-indigo-500"></i>
              Rebalance Simulator
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Global Controls */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 shadow-sm z-10">
          <div className="flex items-center gap-6">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">มูลค่าปัจจุบันรวม</label>
                <div className="text-xl font-black text-slate-700">฿{formatThb(stats.currentTotalWealth)}</div>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">เติมเงินเข้าแผน (New Cash)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                  <input 
                    type="number"
                    value={newCash}
                    onChange={(e) => handleNewCashChange(e.target.value)}
                    placeholder="0"
                    className="pl-7 pr-3 py-1.5 w-40 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm"
                  />
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">มูลค่าจำลองรวม (หลังปรับเอง)</label>
                <div className="text-xl font-black text-emerald-600">฿{formatThb(stats.simTotalWealth)}</div>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                <div className="text-xs">
                   <span className="text-slate-500 font-bold">ยอดจำลองปรับเอง: </span>
                   <span className="text-emerald-600 font-black ml-1"><i className="fa-solid fa-arrow-trend-up mr-1"></i>ซื้อ ฿{formatThb(totalManualBuy)}</span>
                   <span className="text-slate-300 mx-2">|</span>
                   <span className="text-rose-600 font-black"><i className="fa-solid fa-arrow-trend-down mr-1"></i>ขาย ฿{formatThb(totalManualSell)}</span>
                   <span className="text-slate-300 mx-2">|</span>
                   <span className={`font-black ${netManual > 0 ? 'text-amber-500' : netManual < 0 ? 'text-indigo-500' : 'text-slate-400'}`}>
                      {netManual > 0 ? `ต้องเติมเงินเพิ่ม ฿${formatThb(netManual)}` : netManual < 0 ? `เงินสดเหลือ ฿${formatThb(Math.abs(netManual))}` : `ยอดพอดีกันเป๊ะ (฿0)`}
                   </span>
                </div>
             </div>
             <button 
                onClick={() => setShowAddAsset(true)}
                className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
             >
                <i className="fa-solid fa-plus"></i> เพิ่มหุ้นจำลอง
             </button>
          </div>
        </div>

        {/* Validation Warnings */}
        <div className="flex flex-col w-full bg-slate-50 border-b border-slate-200 text-sm font-bold">
           {Math.abs(sumCatTargets - 100) > 0.1 && (
             <div className="p-2 text-center bg-rose-100 text-rose-700 border-b border-rose-200">
                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                เป้าหมาย <b>สินทรัพย์หลัก</b> รวมกันได้ {sumCatTargets}% (ควรปรับให้ได้ 100% ขาด/เกินอยู่ {Math.abs(100 - sumCatTargets).toFixed(1)}%)
             </div>
           )}
           {Math.abs(sumStockTargets - 100) > 0.1 && (
             <div className="p-2 text-center bg-amber-100 text-amber-800">
                <i className="fa-solid fa-circle-exclamation mr-2"></i>
                เป้าหมาย <b>หุ้นย่อย</b> รวมกันได้ {sumStockTargets}% (ของพอร์ตหุ้น) (ควรปรับให้ได้ 100% ขาด/เกินอยู่ {Math.abs(100 - sumStockTargets).toFixed(1)}%)
             </div>
           )}
        </div>

        {/* Add Asset Form Panel */}
        {showAddAsset && (
          <div className="px-6 py-3 bg-slate-800 text-white flex items-center gap-3 animate-fade-in text-xs border-b border-slate-700">
             <span className="font-bold"><i className="fa-solid fa-wand-magic-sparkles text-amber-400 mr-2"></i> หุ้นใหม่:</span>
             <input type="text" placeholder="ชื่อ (เช่น TSLA)" value={addAssetForm.name} onChange={e => setAddAssetForm({...addAssetForm, name: e.target.value.toUpperCase()})} className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded outline-none focus:border-indigo-400 font-bold" />
             <select value={addAssetForm.portfolio} onChange={e => setAddAssetForm({...addAssetForm, portfolio: e.target.value})} className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded outline-none font-bold">
                {CATEGORIES.find(c => c.id === 'หุ้น (Stocks)').portfolios.map(p => <option key={p} value={p}>{p}</option>)}
             </select>
             <button onClick={handleAddNewAsset} className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded font-bold transition-colors">เพิ่ม</button>
             <button onClick={() => setShowAddAsset(false)} className="px-3 py-1.5 bg-transparent hover:bg-slate-700 rounded font-bold text-slate-300 transition-colors">ยกเลิก</button>
          </div>
        )}

        {/* Main Table Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
             <table className="w-full text-left text-[13px] whitespace-nowrap">
                <thead>
                   <tr className="bg-slate-100 text-slate-500 border-b border-slate-200">
                      <th className="p-3 font-bold">สินทรัพย์</th>
                      <th className="p-3 font-bold text-right bg-slate-50">ปัจจุบัน (฿)</th>
                      <th className="p-3 font-bold text-right bg-slate-50 border-r border-slate-200 text-indigo-500">ปัจจุบัน %</th>
                      <th className="p-3 font-bold text-right text-indigo-500">เป้าหมาย %</th>
                      <th className="p-3 font-bold text-right">เป้าหมาย (฿)</th>
                      <th className="p-3 font-bold text-center w-32 bg-amber-50/50 text-amber-800 border-l border-amber-100">ขาด/เกิน (แผน)</th>
                      <th className="p-3 font-bold text-center w-32 bg-indigo-50/30 text-indigo-800 border-l border-indigo-100">ปรับเอง (฿)</th>
                      <th className="p-3 font-bold text-right bg-emerald-50/30 text-emerald-800 border-l border-emerald-100">หลังปรับ (฿)</th>
                      <th className="p-3 font-bold text-right bg-emerald-50/30 text-emerald-800 border-l border-emerald-100 text-emerald-600">จำลอง %</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {CATEGORIES.map(category => {
                      const catAssets = baseAssets.filter(a => a.category === category.id);
                      if (catAssets.length === 0) return null;

                      const isStockCat = category.id === 'หุ้น (Stocks)';
                      const catCurrentVal = stats.currentCatTotals[category.id];
                      const catTarget = parseFloat(targets[`cat_${category.id}`]) || 0;
                      
                      const catCurrentPct = stats.currentTotalWealth > 0 ? (catCurrentVal / stats.currentTotalWealth) * 100 : 0;

                      // Auto-calculate suggested amount for Category using targetTotalWealth
                      const catTargetVal = (catTarget / 100) * stats.targetTotalWealth;
                      const catSuggested = catTargetVal - catCurrentVal;

                      // Display values for category row
                      const catSimVal = stats.simCatTotals[category.id];
                      const catSimPct = stats.simTotalWealth > 0 ? (catSimVal / stats.simTotalWealth) * 100 : 0;

                      return (
                         <React.Fragment key={category.id}>
                            {/* Asset Class Row */}
                            <tr className="bg-slate-50 border-y-2 border-slate-200">
                               <td className="p-3 font-black text-slate-800 text-sm">{category.label}</td>
                               <td className="p-3 text-right font-bold text-slate-600 bg-slate-50/50">฿{formatThb(catCurrentVal)}</td>
                               <td className="p-3 text-right font-black text-indigo-500 text-base bg-slate-50/50 border-r border-slate-200">{catCurrentPct.toFixed(1)}%</td>
                               <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <input type="number" value={targets[`cat_${category.id}`] || ''} onChange={(e) => handleTargetChange(`cat_${category.id}`, e.target.value)} className="w-16 text-right border-2 border-indigo-200 rounded-lg p-1.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-black text-indigo-700 text-base shadow-inner" />
                                    <span className="font-black text-indigo-400">%</span>
                                  </div>
                               </td>
                               <td className="p-3 text-right font-bold text-slate-600">฿{formatThb(catTargetVal)}</td>
                               <td className="p-3 text-center font-black border-l border-amber-100 bg-amber-50/30">
                                  {Math.abs(catSuggested) > 10 ? (
                                    <span className={catSuggested > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                       {catSuggested > 0 ? '+' : ''}{formatThb(catSuggested)}
                                    </span>
                                  ) : <span className="text-slate-300">พอดีเป้า</span>}
                               </td>
                               <td className="p-3 bg-indigo-50/20 border-l border-indigo-50"></td>
                               <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/20 border-l border-emerald-50">฿{formatThb(catSimVal)}</td>
                               <td className="p-3 text-right font-black text-emerald-600 text-base bg-emerald-50/20 border-l border-emerald-50">
                                  {catSimPct.toFixed(1)}%
                               </td>
                            </tr>

                            {/* Sub-portfolios (for Stocks only) */}
                            {isStockCat && category.portfolios.map(portName => {
                               const portAssets = catAssets.filter(a => a.portfolio === portName);
                               if (portAssets.length === 0) return null;

                               const portCurrentVal = stats.currentPortTotals[portName];
                               const portSimVal = stats.simPortTotals[portName];
                               const portCurrentPct = stats.currentCatTotals[category.id] > 0 ? (portCurrentVal / stats.currentCatTotals[category.id]) * 100 : 0;
                               
                               let sumTargets = 0;
                               portAssets.forEach(a => {
                                  sumTargets += parseFloat(targets[`asset_${a.name}`]) || 0;
                               });

                               return (
                                  <React.Fragment key={portName}>
                                     <tr className="bg-white border-b border-slate-100">
                                        <td className="p-2 pl-6 font-bold text-indigo-500 text-[12px]"><i className="fa-solid fa-folder-open mr-2 text-indigo-300"></i>{portName}</td>
                                        <td className="p-2 text-right font-medium text-slate-400 bg-slate-50/30">฿{formatThb(portCurrentVal)}</td>
                                        <td className="p-2 text-right font-medium text-slate-400 bg-slate-50/30 border-r border-slate-100">{portCurrentPct.toFixed(1)}%</td>
                                        <td className="p-2 text-right font-bold text-indigo-400">{sumTargets > 0 ? `${sumTargets.toFixed(1)}%` : '-'}</td>
                                        <td className="p-2 text-right font-medium text-slate-300">-</td>
                                        <td className="p-2 bg-amber-50/10 border-l border-amber-50"></td>
                                        <td className="p-2 bg-indigo-50/10 border-l border-indigo-50"></td>
                                        <td className="p-2 text-right font-bold text-indigo-300 bg-emerald-50/10 border-l border-emerald-50">฿{formatThb(portSimVal)}</td>
                                        <td className="p-2 text-right font-medium text-slate-400 bg-emerald-50/10 border-l border-emerald-50">-</td>
                                     </tr>

                                     {/* Asset Rows for Stocks */}
                                     {portAssets.map(asset => {
                                        const adj = adjustments[asset.name] || '';
                                        const simVal = asset.currentValueTHB + (parseFloat(adj) || 0);
                                        const assetTarget = parseFloat(targets[`asset_${asset.name}`]) || 0;
                                        
                                        const currentLocalPct = stats.currentCatTotals[category.id] > 0 ? (asset.currentValueTHB / stats.currentCatTotals[category.id]) * 100 : 0;

                                        // Auto-calculate suggested amount for Stock Asset
                                        const assetTargetVal = (assetTarget / 100) * catTargetVal;
                                        const assetSuggested = assetTargetVal - asset.currentValueTHB;

                                        // Sim Local Pct = simulated value / simulated total stocks
                                        const simLocalPct = stats.simCatTotals[category.id] > 0 ? (simVal / stats.simCatTotals[category.id]) * 100 : 0;

                                        return (
                                           <tr key={asset.name} className="hover:bg-slate-50 transition-colors">
                                              <td className="p-3 pl-10">
                                                 <div className="font-bold text-slate-700 flex items-center gap-2">
                                                    {asset.name}
                                                    {asset.isNew && (
                                                       <>
                                                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-black">NEW</span>
                                                          <button onClick={() => handleRemoveAsset(asset.name)} className="text-slate-300 hover:text-rose-500 transition-colors" title="ลบหุ้นจำลอง">
                                                             <i className="fa-solid fa-trash-can"></i>
                                                          </button>
                                                       </>
                                                    )}
                                                 </div>
                                              </td>
                                              <td className="p-3 text-right font-medium text-slate-500 bg-slate-50/30">฿{formatThb(asset.currentValueTHB)}</td>
                                              <td className="p-3 text-right font-black text-indigo-400 bg-slate-50/30 border-r border-slate-100">{currentLocalPct.toFixed(1)}%</td>
                                              <td className="p-3 text-right">
                                                 <div className="flex items-center justify-end gap-1">
                                                   <input type="number" value={targets[`asset_${asset.name}`] || ''} onChange={(e) => handleTargetChange(`asset_${asset.name}`, e.target.value)} className="w-14 text-right border-2 border-indigo-200 rounded-lg p-1 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700 shadow-inner" />
                                                   <span className="font-bold text-indigo-400">%</span>
                                                 </div>
                                              </td>
                                              <td className="p-3 text-right font-medium text-slate-600">฿{formatThb(assetTargetVal)}</td>
                                              
                                              <td className="p-3 text-center font-bold border-l border-amber-100 bg-amber-50/10">
                                                 {Math.abs(assetSuggested) > 10 ? (
                                                   <span className={assetSuggested > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                                      {assetSuggested > 0 ? '+' : ''}{formatThb(assetSuggested)}
                                                   </span>
                                                 ) : <span className="text-slate-300">-</span>}
                                              </td>

                                              <td className="p-2 text-center bg-indigo-50/10 border-l border-indigo-50">
                                                 <input type="number" value={adj} onChange={(e) => handleAdjustmentChange(asset.name, e.target.value)} placeholder="+/- ฿" className={`w-20 text-center border rounded-md p-1.5 font-bold outline-none transition-all ${parseFloat(adj) > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : parseFloat(adj) < 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-400'}`} />
                                              </td>
                                              <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/10 border-l border-emerald-50">฿{formatThb(simVal)}</td>
                                              <td className="p-3 text-right font-black bg-emerald-50/10 border-l border-emerald-50">
                                                 <span className={`${Math.abs(simLocalPct - assetTarget) < 1 ? 'text-emerald-600' : 'text-slate-600'}`}>{simLocalPct.toFixed(1)}%</span>
                                              </td>
                                           </tr>
                                        );
                                     })}
                                  </React.Fragment>
                               );
                            })}

                            {/* Asset Rows for Non-Stock Categories (Gold, Cash, etc.) */}
                            {!isStockCat && catAssets.map(asset => {
                               const adj = adjustments[asset.name] || '';
                               const simVal = asset.currentValueTHB + (parseFloat(adj) || 0);

                               return (
                                  <tr key={asset.name} className="hover:bg-slate-50 transition-colors">
                                     <td className="p-3 pl-6">
                                        <div className="font-bold text-slate-700 flex items-center gap-2">
                                           {asset.name}
                                        </div>
                                     </td>
                                     <td className="p-3 text-right font-medium text-slate-500 bg-slate-50/30">฿{formatThb(asset.currentValueTHB)}</td>
                                     <td className="p-3 text-right font-medium text-slate-500 bg-slate-50/30 border-r border-slate-100">-</td>
                                     {/* Hide Target % Input for Non-Stock Assets because they inherit the category target */}
                                     <td className="p-3 text-right font-medium text-slate-300">-</td>
                                     <td className="p-3 text-right font-medium text-slate-300">-</td>
                                     
                                     {/* Auto-suggest for non-stock individual assets isn't as useful if they have multiple assets, but usually there's only one. We leave it blank and rely on Category suggest */}
                                     <td className="p-3 text-center border-l border-amber-100 bg-amber-50/10 text-slate-300">-</td>

                                     <td className="p-2 text-center bg-indigo-50/10 border-l border-indigo-50">
                                        <input type="number" value={adj} onChange={(e) => handleAdjustmentChange(asset.name, e.target.value)} placeholder="+/- ฿" className={`w-20 text-center border rounded-md p-1.5 font-bold outline-none transition-all ${parseFloat(adj) > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : parseFloat(adj) < 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-400'}`} />
                                     </td>
                                     <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/10 border-l border-emerald-50">฿{formatThb(simVal)}</td>
                                     <td className="p-3 text-right font-medium text-slate-400 bg-emerald-50/10 border-l border-emerald-50">-</td>
                                  </tr>
                               );
                            })}
                         </React.Fragment>
                      );
                   })}
                </tbody>
             </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RebalanceSimulator;
