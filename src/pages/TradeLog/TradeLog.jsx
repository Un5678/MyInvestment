import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { submitData } from '../../services/api';
import { calculateTradeStats } from '../../utils/calculations';

// Custom Dropdown for Form Type
const TypeDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const options = [
    { val: 'Buy', label: 'Buy (ซื้อ)', color: 'text-emerald-700 bg-emerald-100' },
    { val: 'Sell', label: 'Sell (ขาย)', color: 'text-rose-700 bg-rose-100' },
    { val: 'Dividend', label: 'Dividend (ปันผล)', color: 'text-emerald-700 bg-emerald-50' },
    { val: 'Interest', label: 'Interest (ดอกเบี้ย)', color: 'text-blue-700 bg-blue-100' },
    { val: 'Deposit', label: 'Deposit (ฝาก)', color: 'text-emerald-700 bg-emerald-100' },
    { val: 'Withdraw', label: 'Withdraw (ถอน)', color: 'text-rose-700 bg-rose-100' }
  ];
  
  const current = options.find(o => o.val === value) || options[0];
  
  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border border-slate-100 rounded-xl p-2.5 h-11 text-sm font-bold flex justify-between items-center cursor-pointer hover:opacity-80 transition-colors ${current.color}`}
      >
        <span>{current.label}</span>
        <i className={`fa-solid fa-chevron-down text-slate-400 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in flex flex-col gap-1">
            {options.map(opt => (
              <div 
                key={opt.val} 
                onClick={() => { onChange(opt.val); setIsOpen(false); }}
                className={`px-4 py-2 mx-2 rounded-lg cursor-pointer text-sm font-bold transition-all hover:opacity-80 ${opt.color}`}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const FilterDropdown = ({ value, onChange, isForm = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const allOptions = [
    { value: '', label: isForm ? '-- กรุณาเลือกพอร์ตลงทุน' : 'สินทรัพย์ทั้งหมด', icon: isForm ? '' : 'fa-solid fa-globe' },
    { value: 'Core Portfolio', label: 'Core Portfolio', icon: 'fa-solid fa-bullseye' },
    { value: 'Satellite Portfolio', label: 'Satellite Portfolio', icon: 'fa-solid fa-rocket' },
    { value: 'Alpha Portfolio', label: 'Alpha Portfolio', icon: 'fa-solid fa-bolt' },
    { value: 'Defensive Portfolio', label: 'Defensive Portfolio', icon: 'fa-solid fa-shield-halved' },
    { value: 'Dividend Portfolio', label: 'Dividend Portfolio', icon: 'fa-solid fa-hand-holding-dollar' },
    { value: 'กองทุน (Funds)', label: 'กองทุน (Funds)', icon: 'fa-solid fa-piggy-bank' },
    { value: 'คริปโต (Crypto)', label: 'คริปโต (Crypto)', icon: 'fa-brands fa-bitcoin' },
    { value: 'ทองคำ (Gold)', label: 'ทองคำ (Gold)', icon: 'fa-solid fa-coins' },
    { value: 'เงินสด (Cash)', label: 'เงินสด (Cash)', icon: 'fa-solid fa-money-bill-wave' }
  ];
  const options = allOptions;

  const currentOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full ${isForm ? 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100' : 'md:w-56 bg-indigo-50/50 border-indigo-100 text-indigo-900 hover:bg-indigo-50'} h-11 py-2 pl-3 pr-3 rounded-xl text-sm font-bold cursor-pointer border shadow-sm transition-colors`}
      >
        <div className="flex items-center gap-2 truncate">
           {currentOption.icon && <i className={`${currentOption.icon} ${isForm ? 'text-slate-400' : 'text-indigo-400'}`}></i>}
           <span className="truncate">{currentOption.label}</span>
        </div>
        <i className={`fa-solid fa-chevron-down ${isForm ? 'text-slate-400' : 'text-indigo-400'} text-xs transition-transform ml-2 ${isOpen ? 'rotate-180' : ''}`}></i>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className={`absolute top-full ${isForm ? 'left-0 mt-1 w-full' : 'right-0 mt-2 w-56 origin-top-right'} bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-50 animate-fade-in`}>
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors text-sm whitespace-nowrap ${value === opt.value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}
              >
                {opt.icon && <i className={`${opt.icon} ${value === opt.value ? 'text-indigo-500' : 'text-slate-400'}`}></i>}
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const TradeLog = () => {
  const { loading, data, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [portfolioFilter, setPortfolioFilter] = useState('');

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPortfolio, setFormPortfolio] = useState('');
  const [formType, setFormType] = useState('Buy');
  const [formSymbol, setFormSymbol] = useState('');
  const [formVolume, setFormVolume] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formFee, setFormFee] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading && data.tradeData.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const formatThb = (val) => (Number(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Auto calculate total
  const calculateTotal = () => {
    const vol = parseFloat(formVolume) || 0;
    const price = parseFloat(formPrice) || 0;
    const fee = parseFloat(formFee) || 0;
    
    let total = 0;
    if (formType === 'Buy' || formType === 'Deposit') {
        total = (vol * price) + fee;
    } else if (formType === 'Sell' || formType === 'Withdraw') {
        total = (vol * price) - fee;
    } else if (formType === 'Dividend' || formType === 'Interest') {
        total = (vol * price) - fee;
    }
    return total.toFixed(2);
  };

  const handleSave = async () => {
    if (!formPortfolio) {
        alert("กรุณาเลือกพอร์ตลงทุนก่อน");
        return;
    }
    if (!formDate || !formType) {
        alert("กรุณากรอกวันที่และประเภทให้ครบถ้วน");
        return;
    }
    
    const hasVolumePrice = formVolume && formPrice;
    const hasFee = formFee && Number(formFee) !== 0;

    if (!hasVolumePrice && !hasFee) {
        alert("กรุณากรอก 'จำนวนหน่วยและราคา' หรือ 'ค่าธรรมเนียม' อย่างใดอย่างหนึ่ง");
        return;
    }

    if (hasVolumePrice && !formSymbol) {
        alert("กรุณากรอกสัญลักษณ์ (Symbol)");
        return;
    }

    setIsSubmitting(true);
    try {
        const result = await submitData({
            action: 'saveTrade',
            sheetName: 'TradeLog',
            date: formDate,
            portfolio: formPortfolio,
            type: formType,
            symbol: (formSymbol || '').toUpperCase(),
            volume: formVolume || 0,
            price: formPrice || 0,
            fee: formFee || 0,
            totalValue: calculateTotal(),
            rowIndex: ''
        });

        if (result && result.status === 'error') {
             alert(`Error: ${result.message || 'Unknown server error'}`);
             return;
        }
        
        // Reset some fields but keep date and portfolio for convenience
        setFormSymbol('');
        setFormVolume('');
        setFormPrice('');
        setFormFee('');
        await refreshData();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (index) => {
    if (!window.confirm('คุณต้องการลบข้อมูลนี้ใช่หรือไม่?')) return;
    try {
        const item = filteredTrades[index];
        const originalIndex = data.tradeData.indexOf(item);
        
        const result = await submitData({
            action: 'delete',
            sheetName: 'TradeLog',
            rowIndex: originalIndex + 2
        });

        if (result && result.status === 'error') {
             alert(`Error: ${result.message || 'Unknown server error'}`);
             return;
        }
        await refreshData();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  // Filter Trades
  const filteredTrades = data.tradeData.filter(item => {
    let matchSearch = true;
    let matchPort = true;
    if (searchTerm) {
        matchSearch = String(item.symbol || '').toUpperCase().includes(searchTerm.toUpperCase()) || 
                      String(item.portfolio || '').toUpperCase().includes(searchTerm.toUpperCase());
    }
    if (portfolioFilter) {
        matchPort = String(item.portfolio || '') === portfolioFilter;
    }
    return matchSearch && matchPort;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculate local stats based on filters
  const localTradeStats = calculateTradeStats(filteredTrades, data.globalExchangeRate);

  // Unique symbols for autocomplete
  const uniqueSymbols = Array.from(new Set(
    data.tradeData
      .filter(t => t.portfolio === formPortfolio && t.symbol)
      .map(t => t.symbol)
  )).sort();

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Top Section: Form & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Entry Form (Left) */}
        <section className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative z-20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <i className="fa-solid fa-plus-circle text-indigo-500"></i> บันทึกการทำรายการ
            </h3>
            <div className="w-36">
              <input 
                type="date" 
                value={formDate} 
                onChange={e => setFormDate(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:ring-2 focus:ring-indigo-300 outline-none font-bold shadow-sm cursor-pointer" 
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
              <div className="relative z-30">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase truncate">พอร์ตลงทุน</label>
                  <FilterDropdown value={formPortfolio} onChange={setFormPortfolio} isForm={true} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase truncate">ประเภท</label>
                  <TypeDropdown value={formType} onChange={setFormType} />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase truncate">สัญลักษณ์</label>
                  <input 
                    type="text" 
                    value={formSymbol} 
                    onChange={e => setFormSymbol(e.target.value)} 
                    placeholder="เช่น AAPL"
                    list="symbol-suggestions"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 h-11 text-sm focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-bold uppercase" 
                  />
                  <datalist id="symbol-suggestions">
                    {uniqueSymbols.map(sym => <option key={sym} value={sym} />)}
                  </datalist>
              </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase truncate">จำนวนหน่วย</label>
                  <input type="number" value={formVolume} onChange={e => setFormVolume(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 h-11 text-sm focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-bold" />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase truncate">ราคา/หน่วย</label>
                  <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 h-11 text-sm focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-bold" />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase truncate">ค่าธรรมเนียม</label>
                  <input type="number" value={formFee} onChange={e => setFormFee(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 h-11 text-sm focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-bold" />
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase truncate">มูลค่าสุทธิ</label>
                  <input type="text" value={calculateTotal()} className="w-full bg-emerald-50 border-none rounded-xl p-2.5 h-11 text-sm outline-none text-emerald-700 font-bold" readOnly />
              </div>
          </div>
          <div className="mt-6">
              <button onClick={handleSave} disabled={isSubmitting} className="w-full h-11 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-save"></i> บันทึก</>}
              </button>
          </div>
        </section>

        {/* Stats Cards (Right) */}
        <section className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
             <i className="fa-solid fa-chart-pie text-indigo-500"></i> สรุปข้อมูลการลงทุนทั้งหมด
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 flex-1 grid-rows-2">
            {/* Interest */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center h-full relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-12 h-12 bg-blue-50 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
               <p className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 whitespace-nowrap"><i className="fa-solid fa-piggy-bank text-blue-400"></i> ดอกเบี้ยรับ</p>
               <div className="flex flex-col">
                 <p className={`text-lg font-extrabold ${localTradeStats.totalInterestTHB === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>฿{formatThb(localTradeStats.totalInterestTHB)}</p>
                 <p className={`text-[11px] font-semibold mt-0.5 ${localTradeStats.totalInterestUSD === 0 ? 'text-slate-400/70' : 'text-emerald-600/70'}`}>(${formatThb(localTradeStats.totalInterestUSD)})</p>
               </div>
            </div>
            {/* Gross Div */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center h-full relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-12 h-12 bg-emerald-50 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
               <p className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 whitespace-nowrap"><i className="fa-solid fa-hand-holding-dollar text-emerald-400"></i> ปันผล(ก่อนหักภาษี)</p>
               <div className="flex flex-col">
                 <p className={`text-lg font-extrabold ${localTradeStats.totalDividendGrossTHB === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>฿{formatThb(localTradeStats.totalDividendGrossTHB)}</p>
                 <p className={`text-[11px] font-semibold mt-0.5 ${localTradeStats.totalDividendGrossUSD === 0 ? 'text-slate-400/70' : 'text-emerald-600/70'}`}>(${formatThb(localTradeStats.totalDividendGrossUSD)})</p>
               </div>
            </div>
            {/* Net Div */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center h-full relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-12 h-12 bg-green-50 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
               <p className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 whitespace-nowrap"><i className="fa-solid fa-sack-dollar text-green-500"></i> ปันผล(หลังหักภาษี)</p>
               <div className="flex flex-col">
                 <p className={`text-lg font-extrabold ${localTradeStats.netDividendTHB === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>฿{formatThb(localTradeStats.netDividendTHB)}</p>
                 <p className={`text-[11px] font-semibold mt-0.5 ${localTradeStats.netDividendUSD === 0 ? 'text-slate-400/70' : 'text-emerald-600/70'}`}>(${formatThb(localTradeStats.netDividendUSD)})</p>
               </div>
            </div>
            {/* Trading Fees */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center h-full relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-12 h-12 bg-slate-100 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
               <p className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 whitespace-nowrap"><i className="fa-solid fa-receipt text-slate-400"></i> ค่าธรรมเนียมซื้อ-ขาย</p>
               <div className="flex flex-col">
                 <p className={`text-lg font-extrabold ${localTradeStats.totalTradingFeeTHB === 0 ? 'text-slate-400' : 'text-rose-600'}`}>฿{formatThb(localTradeStats.totalTradingFeeTHB)}</p>
                 <p className={`text-[11px] font-semibold mt-0.5 ${localTradeStats.totalTradingFeeUSD === 0 ? 'text-slate-400/70' : 'text-rose-600/70'}`}>(${formatThb(localTradeStats.totalTradingFeeUSD)})</p>
               </div>
            </div>
            {/* Tax */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center h-full relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-12 h-12 bg-rose-50 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
               <p className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 whitespace-nowrap"><i className="fa-solid fa-file-invoice-dollar text-rose-400"></i> ภาษีหัก ณ ที่จ่าย</p>
               <div className="flex flex-col">
                 <p className={`text-lg font-extrabold ${localTradeStats.totalDividendTaxTHB === 0 ? 'text-slate-400' : 'text-rose-600'}`}>฿{formatThb(localTradeStats.totalDividendTaxTHB)}</p>
                 <p className={`text-[11px] font-semibold mt-0.5 ${localTradeStats.totalDividendTaxUSD === 0 ? 'text-slate-400/70' : 'text-rose-600/70'}`}>(${formatThb(localTradeStats.totalDividendTaxUSD)})</p>
               </div>
            </div>
            {/* Total Fees */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col justify-center h-full relative overflow-hidden group">
               <div className="absolute -right-4 -top-4 w-12 h-12 bg-red-50 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
               <p className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 whitespace-nowrap"><i className="fa-solid fa-calculator text-red-400"></i> รวมค่าธรรมเนียมทั้งหมด</p>
               <div className="flex flex-col">
                 <p className={`text-lg font-extrabold ${localTradeStats.totalFeesTHB === 0 ? 'text-slate-400' : 'text-rose-600'}`}>฿{formatThb(localTradeStats.totalFeesTHB)}</p>
                 <p className={`text-[11px] font-semibold mt-0.5 ${localTradeStats.totalFeesUSD === 0 ? 'text-slate-400/70' : 'text-rose-600/70'}`}>(${formatThb(localTradeStats.totalFeesUSD)})</p>
               </div>
            </div>
          </div>
        </section>
      </div>

      {/* Table Section with Integrated Search */}
      <section className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden relative z-10">
        {/* Table Header & Search Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-indigo-500"></i> ตารางประวัติการทำรายการ
          </h2>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <i className="fa-solid fa-search text-slate-400"></i>
              </div>
              <input 
                type="text" 
                placeholder="ค้นหาสัญลักษณ์ หรือ พอร์ต..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 h-10 w-full md:w-64 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-slate-700 shadow-sm transition-all"
              />
            </div>
            <FilterDropdown value={portfolioFilter} onChange={setPortfolioFilter} />
          </div>
        </div>

        <div className="overflow-x-auto px-6 pb-6 mt-4">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-emerald-50/80 text-emerald-900 font-bold border-b border-emerald-100">
                <th className="p-4 uppercase tracking-wider text-xs rounded-tl-xl">วันที่</th>
                <th className="p-4 uppercase tracking-wider text-xs">พอร์ต</th>
                <th className="p-4 uppercase tracking-wider text-xs">ประเภท</th>
                <th className="p-4 uppercase tracking-wider text-xs">สัญลักษณ์</th>
                <th className="p-4 uppercase tracking-wider text-xs text-right">จำนวน</th>
                <th className="p-4 uppercase tracking-wider text-xs text-right">ราคา</th>
                <th className="p-4 uppercase tracking-wider text-xs text-right">ค่าธรรมเนียม</th>
                <th className="p-4 uppercase tracking-wider text-xs text-right">มูลค่ารวม</th>
                <th className="p-4 uppercase tracking-wider text-xs text-center rounded-tr-xl">ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTrades.length > 0 ? (
                filteredTrades.slice(0, 100).map((item, idx) => {
                  let typeClass = 'bg-slate-100 text-slate-700';
                  if (item.type === 'Buy' || item.type === 'Deposit') typeClass = 'bg-emerald-100 text-emerald-700';
                  if (item.type === 'Sell' || item.type === 'Withdraw') typeClass = 'bg-rose-100 text-rose-500';
                  if (item.type === 'Dividend') typeClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                  if (item.type === 'Interest') typeClass = 'bg-blue-100 text-blue-700';

                  let displayDate = item.date;
                  if (displayDate.includes('T')) displayDate = displayDate.split('T')[0];

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4 text-slate-500 font-medium">{displayDate}</td>
                      <td className="p-4 text-slate-600 font-medium">{item.portfolio}</td>
                      <td className="p-4">
                        <span className={`${typeClass} px-3 py-1 rounded-lg text-xs font-bold shadow-sm`}>{item.type}</span>
                      </td>
                      <td className="p-4 font-extrabold text-slate-800 uppercase">{item.symbol}</td>
                      <td className="p-4 text-slate-600 font-medium text-right">{parseFloat(item.volume).toLocaleString('en-US', {maximumFractionDigits: 4})}</td>
                      <td className="p-4 text-slate-600 font-medium text-right">{parseFloat(item.price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 4})}</td>
                      <td className="p-4 text-slate-600 font-medium text-right">{parseFloat(item.fee).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 font-bold text-slate-700 text-right">{parseFloat(item.totalValue).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => handleDelete(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-2 rounded-full hover:bg-rose-50">
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-400 font-medium">ไม่พบข้อมูลการทำรายการ</td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredTrades.length > 100 && (
            <div className="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50/50">
              กำลังแสดงผล 100 รายการล่าสุด
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TradeLog;
