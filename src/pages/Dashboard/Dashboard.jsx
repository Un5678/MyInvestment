import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler, BarElement } from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';
import RebalanceSimulator from '../../components/RebalanceSimulator';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler, BarElement);

// Custom Dropdown Component
const CustomDropdown = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-64 md:w-80 bg-green-50/90 text-green-900 border border-green-200 shadow-[0_4px_20px_rgb(0,0,0,0.05)] py-3 px-5 rounded-2xl transition-all hover:bg-white"
      >
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700">
             <i className={currentOption?.icon || "fa-solid fa-layer-group"}></i>
           </div>
           <span className="font-bold text-green-900 text-base">{currentOption?.label || value}</span>
        </div>
        <i className={`fa-solid fa-chevron-down text-green-800 text-sm transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 md:w-80 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-5 py-3 flex items-center gap-3 transition-colors ${value === opt.value ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}
            >
              <i className={`${opt.icon || "fa-solid fa-cube"} ${value === opt.value ? 'text-emerald-500' : 'text-slate-400'}`}></i>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


const Dashboard = () => {
  const { loading, data, dashboardStats, selectedFilter, setSelectedFilter, timeframe, setTimeframe, viewMode, setViewMode } = useData();
  const [targets, setTargets] = useState({});


  const getScalingFactor = (asset) => {
      let isSubPort = ['Core Portfolio', 'Satellite Portfolio', 'Alpha Portfolio', 'Defensive Portfolio', 'Dividend Portfolio'].includes(selectedFilter);
      let effectiveViewMode = isSubPort ? 'individual' : viewMode;

      if (effectiveViewMode === 'grouped' || asset.isCash) return 1;

      let isStockSubPort = asset.parentPort && ['Core Portfolio', 'Satellite Portfolio', 'Alpha Portfolio', 'Defensive Portfolio', 'Dividend Portfolio'].includes(asset.parentPort);
      let topLevelClass = isStockSubPort ? 'หุ้น (Stocks)' : asset.parentPort;

      let classTgt = parseFloat(targets[topLevelClass]) || 100;
      
      if (selectedFilter === 'สินทรัพย์ทั้งหมด (Total Wealth)') {
          // Rule 4: Total Wealth (Individual) = Target_Individual * (Target_AssetClass / 100)
          return classTgt / 100;
      } else if (selectedFilter === topLevelClass) {
          // Rule 3: Stocks (Individual) is the base level for raw inputs, so factor is 1
          return 1;
      } else {
          // Rule 5, 6: Sub-portfolio view (e.g. Core Portfolio)
          // Scale by the sub-portfolio's explicitly set target
          let parentTgt = parseFloat(targets[asset.parentPort]) || 100;
          return parentTgt > 0 ? 100 / parentTgt : 1;
      }
  };
  const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' });
  const [monthlyView, setMonthlyView] = useState('monthly'); // 'monthly' | 'cumulative'
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (!loading && dashboardStats && !hasScrolledRef.current) {
      setTimeout(() => window.scrollTo(0, 0), 10);
      hasScrolledRef.current = true;
    }
  }, [loading, dashboardStats]);

  useEffect(() => {
    if (dashboardStats) {
        const loadedTargets = {};
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key && key.startsWith('target_')) {
                loadedTargets[key.replace('target_', '')] = localStorage.getItem(key);
            }
        }
        setTargets(loadedTargets);
    }
  }, [dashboardStats]);

  const handleTargetChange = (asset, value) => {
      let valToSave = value;
      if (value !== '') {
          const factor = getScalingFactor(asset);
          valToSave = (parseFloat(value) / factor).toFixed(2);
          if (valToSave.endsWith('.00')) valToSave = parseFloat(valToSave).toString();
      }
      localStorage.setItem('target_' + asset.name, valToSave);
      setTargets(prev => ({...prev, [asset.name]: valToSave}));
  };

  const rawAssetList = dashboardStats?.assetList;

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const assetList = React.useMemo(() => {
    if (!rawAssetList) return [];
    let sortableItems = [...rawAssetList];
    
    sortableItems.sort((a, b) => {
      let aValue = 0;
      let bValue = 0;
      
      if (sortConfig.key === 'value' || sortConfig.key === 'proportion') {
        aValue = a.value;
        bValue = b.value;
      } else if (sortConfig.key === 'pl') {
        aValue = a.isCash ? -Infinity : (a.value - a.costBasisUSD);
        bValue = b.isCash ? -Infinity : (b.value - b.costBasisUSD);
      } else if (sortConfig.key === 'target') {
        aValue = parseFloat(targets[a.name]) || 0;
        bValue = parseFloat(targets[b.name]) || 0;
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sortableItems;
  }, [rawAssetList, sortConfig, targets]);

  if (loading && !dashboardStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!dashboardStats) return <div className="p-8 text-center text-slate-500">ไม่มีข้อมูล หรือ เกิดข้อผิดพลาดในการโหลดข้อมูล</div>;

  const { cards, chart, pie, monthlyPerformance } = dashboardStats;

  const baseColors = [
    '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#EC4899', '#6366F1',
    '#84CC16', '#0EA5E9', '#F43F5E', '#D946EF', '#06B6D4', '#EAB308', '#F97316', '#2DD4BF',
    '#818CF8', '#64748B', '#A855F7', '#1D4ED8', '#B91C1C', '#047857', '#C2410C', '#4338CA'
  ];
  let chartColors = pie.data.map((_, i) => baseColors[i % baseColors.length]).reverse();
  let chartLabels = [...pie.labels].reverse();
  let chartData = [...pie.data].reverse();

  const formatThb = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatUsd = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const portfolioOptions = [
    { value: 'สินทรัพย์ทั้งหมด (Total Wealth)', label: 'ภาพรวมสินทรัพย์ทั้งหมด', icon: 'fa-solid fa-globe' },
    { value: 'หุ้น (Stocks)', label: 'หุ้น (Stocks)', icon: 'fa-solid fa-chart-simple' },
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

  // Keep the latest month on the left
  const chartPerformance = dashboardStats?.monthlyPerformance || [];

  const monthlyChartLabels = chartPerformance.map(item => {
    let dateObj = new Date(item.month + "-01");
    return dateObj.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
  }) || [];

  const monthlyChartData = {
    labels: monthlyChartLabels,
    datasets: monthlyView === 'monthly' ? [
      {
        label: 'กำไร/ขาดทุนรายเดือน',
        data: chartPerformance.map(item => item.plTHB) || [],
        pctData: chartPerformance.map(item => item.plPct) || [],
        backgroundColor: chartPerformance.map(item => item.plTHB >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)') || [],
        hoverBackgroundColor: chartPerformance.map(item => item.plTHB >= 0 ? '#10b981' : '#f43f5e') || [],
        borderRadius: 4,
      }
    ] : [
      {
        label: 'กำไร/ขาดทุนสะสม',
        data: chartPerformance.map(item => item.cumulativePL) || [],
        pctData: chartPerformance.map(item => item.cumulativePct) || [],
        backgroundColor: chartPerformance.map(item => item.cumulativePL >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)') || [],
        hoverBackgroundColor: chartPerformance.map(item => item.cumulativePL >= 0 ? '#10b981' : '#f43f5e') || [],
        borderRadius: 4,
      }
    ]
  };

  const monthlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        titleColor: '#1e293b', 
        bodyColor: '#475569', 
        borderColor: '#e2e8f0', 
        borderWidth: 1, 
        padding: 12, 
        boxPadding: 6, 
        usePointStyle: true, 
        titleFont: { family: "'Prompt', sans-serif", size: 14 }, 
        bodyFont: { family: "'Prompt', sans-serif", size: 14, weight: 'bold' },
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            let val = context.parsed.y || 0;
            let prefix = val >= 0 ? '+' : '';
            return ` ${label}: ${prefix}฿${new Intl.NumberFormat('en-US').format(val)}`;
          }
        }
      }
    },
    scales: {
      x: { 
        grid: { display: false }, 
        ticks: { maxTicksLimit: 12, font: { family: "'Prompt', sans-serif" } } 
      },
      y: { 
        grid: { 
          color: (context) => context.tick.value === 0 ? '#94a3b8' : '#f1f5f9',
          lineWidth: (context) => context.tick.value === 0 ? 2 : 1,
          borderDash: (context) => context.tick.value === 0 ? [] : [5, 5]
        }, 
        ticks: { font: { family: "'Prompt', sans-serif" } } 
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-40">
        
        {/* Dropdown Card */}
        <div className="lg:col-span-1 bg-green-100/90 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-green-200 relative z-50 group flex flex-col justify-center">
          <div className="absolute inset-0 overflow-hidden rounded-3xl z-0">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white rounded-full opacity-40 blur-3xl"></div>
          </div>
          <div className="relative z-10 w-full">
            <h3 className="text-green-800 font-bold text-sm mb-3 flex items-center gap-1.5 uppercase tracking-wider">
              <i className="fa-solid fa-layer-group text-green-600"></i> เลือกพอร์ตการลงทุน
            </h3>
            <div className="w-full">
              <CustomDropdown 
                value={selectedFilter} 
                onChange={setSelectedFilter} 
                options={portfolioOptions} 
              />
            </div>
          </div>
        </div>

      {/* 3 Number Cards Wrapper */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Total Wealth */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-center">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative flex flex-col justify-between h-full">
            <h3 className="text-slate-500 font-bold text-sm mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <i className="fa-solid fa-wallet text-emerald-500"></i> มูลค่าพอร์ตทั้งหมด
            </h3>
            <div>
              <p className="text-2xl xl:text-3xl font-extrabold text-slate-800 tracking-tight">฿{formatThb(cards.totalWealthTHB)}</p>
              <p className="text-sm font-bold text-slate-400 mt-0.5">(${formatUsd(cards.totalWealthUSD)})</p>
            </div>
          </div>
        </div>

        {/* Unrealized P/L */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-center">
           <div className="relative flex flex-col justify-between h-full">
              <h3 className="text-slate-500 font-bold text-sm mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <i className="fa-solid fa-seedling text-amber-500"></i> กำไร / ขาดทุน ปัจจุบัน
              </h3>
              <div>
                  <p className={`text-2xl xl:text-3xl font-extrabold tracking-tight ${Math.abs(cards.totalUnrealizedPL_THB) < 0.01 ? 'text-slate-400' : (cards.totalUnrealizedPL_THB > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                     {cards.totalUnrealizedPL_THB >= 0 ? '+' : '-'}฿{formatThb(Math.abs(cards.totalUnrealizedPL_THB))}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                     <p className={`text-sm font-bold ${Math.abs(cards.totalUnrealizedPL_USD) < 0.01 ? 'text-slate-400' : (cards.totalUnrealizedPL_USD > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                         ({cards.totalUnrealizedPL_USD >= 0 ? '+' : '-'}${formatUsd(Math.abs(cards.totalUnrealizedPL_USD))})
                     </p>
                     <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${Math.abs(cards.totalUnrealizedPL_THB) < 0.01 ? 'bg-slate-100 text-slate-500' : (cards.totalUnrealizedPL_THB > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}`}>
                         {cards.totalUnrealizedPL_Pct >= 0 ? '+' : '-'}{Math.abs(cards.totalUnrealizedPL_Pct).toFixed(2)}%
                     </span>
                  </div>
              </div>
           </div>
        </div>

        {/* Total P/L (Cumulative) */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-center">
           <div className="relative flex flex-col justify-between h-full">
              <h3 className="text-slate-500 font-bold text-sm mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <i className="fa-solid fa-chart-line text-cyan-500"></i> กำไร / ขาดทุน สะสม
              </h3>
              <div>
                  <p className={`text-2xl xl:text-3xl font-extrabold tracking-tight ${Math.abs(cards.totalPL_THB) < 0.01 ? 'text-slate-400' : (cards.totalPL_THB > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                     {cards.totalPL_THB >= 0 ? '+' : '-'}฿{formatThb(Math.abs(cards.totalPL_THB))}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                     <p className={`text-sm font-bold ${Math.abs(cards.totalPL_USD) < 0.01 ? 'text-slate-400' : (cards.totalPL_USD > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                         ({cards.totalPL_USD >= 0 ? '+' : '-'}${formatUsd(Math.abs(cards.totalPL_USD))})
                     </p>
                     <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${Math.abs(cards.totalPL_THB) < 0.01 ? 'bg-slate-100 text-slate-500' : (cards.totalPL_THB > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}`}>
                         {cards.totalPL_Pct >= 0 ? '+' : '-'}{Math.abs(cards.totalPL_Pct).toFixed(2)}%
                     </span>
                  </div>
              </div>
           </div>
        </div>
      </div>
    </div>

    {/* Middle Section: Pie Chart + Asset Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col h-full lg:col-span-1">
          <h3 className="text-slate-800 font-bold text-lg mb-6">สัดส่วนสินทรัพย์</h3>
          <div className="flex-1 relative min-h-[300px] flex items-center justify-center">
            {pie.data.length > 0 ? (
              <Pie 
                data={{
                  labels: chartLabels,
                  datasets: [{
                    data: chartData,
                    backgroundColor: chartColors,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 8
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { reverse: true, position: 'bottom', labels: { padding: 20, usePointStyle: true, font: { family: "'Prompt', sans-serif", size: 13, weight: 'bold' } } },
                    tooltip: { 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      bodyColor: '#1e293b', 
                      titleColor: '#1e293b',
                      borderColor: '#e2e8f0', 
                      borderWidth: 1, 
                      padding: 12, 
                      bodyFont: { family: "'Prompt', sans-serif", size: 14, weight: 'bold' },
                      callbacks: {
                        label: function(context) {
                          let label = context.label || '';
                          let value = context.parsed || 0;
                          let total = context.chart._metasets[context.datasetIndex].total;
                          let percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                          return [
                            ` ${label}`,
                            ` ฿${new Intl.NumberFormat('en-US').format(value)} (${percentage}%)`
                          ];
                        }
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="text-slate-400 font-medium">ไม่มีข้อมูลสินทรัพย์</div>
            )}
          </div>
        </div>

        {/* Asset List Table */}
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden lg:col-span-2 flex flex-col h-full">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-list-ul text-emerald-400"></i> รายการสินทรัพย์ที่ถือครอง
              </h3>
              {(selectedFilter === 'สินทรัพย์ทั้งหมด (Total Wealth)' || selectedFilter === 'หุ้น (Stocks)') && (
                  <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                      <button 
                          onClick={() => setViewMode('grouped')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'grouped' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                          จัดกลุ่ม
                      </button>
                      <button 
                          onClick={() => setViewMode('individual')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'individual' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                          รายตัว
                      </button>
                  </div>
              )}
            </div>
            <button 
              onClick={() => setIsSimulatorOpen(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-sm rounded-xl transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-calculator"></i> จำลองปรับพอร์ต
            </button>
          </div>
          
          <RebalanceSimulator 
            isOpen={isSimulatorOpen} 
            onClose={() => setIsSimulatorOpen(false)} 
            data={data}
            dashboardStats={dashboardStats} 
          />
          <div className="overflow-x-auto flex-1 px-6 pb-6 mt-4">
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-emerald-50/80 backdrop-blur-sm z-10">
                <tr className="text-emerald-900 font-bold border-b border-emerald-100 whitespace-nowrap">
                  <th className="p-4 uppercase tracking-wider text-sm rounded-tl-xl">สัญลักษณ์</th>
                  <th className="p-4 uppercase tracking-wider text-sm">ราคาต้นทุน</th>
                  <th className="p-4 uppercase tracking-wider text-sm">ราคาอ้างอิง</th>
                  <th className="p-4 uppercase tracking-wider text-sm cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort('pl')}>
                    กำไร/ขาดทุน {sortConfig.key === 'pl' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-center w-32 uppercase tracking-wider text-sm cursor-pointer hover:bg-slate-200/50 transition-colors" onClick={() => handleSort('proportion')}>
                    สัดส่วน {sortConfig.key === 'proportion' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-4 text-center w-28 uppercase tracking-wider text-sm cursor-pointer hover:bg-slate-200/50 transition-colors rounded-tr-xl" onClick={() => handleSort('target')}>
                    เป้าหมาย (%) {sortConfig.key === 'target' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {assetList.length > 0 ? (
                  assetList.map((asset, idx) => {
                    let totalWealthForPercent = cards.totalWealthUSD;
                    let percent = totalWealthForPercent > 0 ? ((asset.value / totalWealthForPercent) * 100).toFixed(1) : "0.0";
                    let assetValTHB = asset.value * data.globalExchangeRate;
                    
                    let assetPL_USD = asset.value - asset.costBasisUSD;
                    let assetPL_THB = assetPL_USD * data.globalExchangeRate;
                    let assetPL_Pct = asset.costBasisUSD > 0 ? (assetPL_USD / asset.costBasisUSD) * 100 : 0;
                    
                    let isCash = asset.isCash;
                    
                    let scalingFactor = getScalingFactor(asset);
                    let rawTargetVal = targets[asset.name];
                    
                    if (!rawTargetVal && asset.parentPort && dashboardStats.holdings[asset.parentPort]) {
                        let siblings = Object.keys(dashboardStats.holdings[asset.parentPort]);
                        if (siblings.length === 1) {
                            rawTargetVal = '100';
                        }
                    }
                    rawTargetVal = rawTargetVal || '';
                    
                    let targetVal = rawTargetVal ? (parseFloat(rawTargetVal) * scalingFactor).toFixed(2) : '';
                    if (targetVal.endsWith('.00')) targetVal = parseFloat(targetVal).toString();

                    let diff = 0;
                    let diffStatus = '';
                    let diffClass = '';
                    let barWidth = percent;
                    let barColor = 'bg-emerald-500';

                    if (targetVal) {
                        let tVal = parseFloat(targetVal);
                        diff = parseFloat(percent) - tVal;
                        
                        if (tVal > 0) {
                            barWidth = Math.min((parseFloat(percent) / tVal) * 100, 100);
                        }

                        if (Math.abs(diff) <= 2) {
                            diffStatus = `พอดี (${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%)`;
                            diffClass = 'text-emerald-500';
                            barColor = 'bg-emerald-500';
                        } else if (diff > 2) {
                            diffStatus = `เกิน (+${diff.toFixed(1)}%)`;
                            diffClass = 'text-rose-500';
                            barColor = 'bg-rose-500';
                        } else {
                            diffStatus = `ขาด (${diff.toFixed(1)}%)`;
                            diffClass = 'text-amber-500';
                            barColor = 'bg-amber-500';
                        }
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group whitespace-nowrap">
                        <td className="p-4 font-extrabold text-slate-800">{asset.name.replace(' Portfolio', '')}</td>
                        <td className="p-4 text-slate-500 font-medium">
                          {isCash ? '-' : (asset.avgCost ? (asset.baseCurrency === 'THB' ? '฿' : '$') + asset.avgCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-')}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-700">฿{formatThb(assetValTHB)}</div>
                          {!asset.name.toUpperCase().includes('DIME SAVE') && (
                            <div className="text-xs text-slate-400 font-medium">(${formatUsd(asset.value)})</div>
                          )}
                        </td>
                        <td className="p-4">
                          {isCash ? <span className="text-slate-400">-</span> : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold ${Math.abs(assetPL_THB) < 0.01 ? 'text-slate-400' : (assetPL_THB > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                                  {assetPL_THB >= 0 ? '+' : '-'}฿{formatThb(Math.abs(assetPL_THB))}
                                </span>
                                <span className={`text-[10px] w-fit font-bold px-1.5 py-0.5 rounded-md ${Math.abs(assetPL_Pct) < 0.01 ? 'bg-slate-100 text-slate-500' : (assetPL_Pct > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}`}>
                                  {assetPL_Pct >= 0 ? '+' : '-'}{Math.abs(assetPL_Pct).toFixed(2)}%
                                </span>
                              </div>
                              <span className={`text-xs font-medium mt-0.5 ${Math.abs(assetPL_USD) < 0.01 ? 'text-slate-400' : (assetPL_USD > 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                                ({assetPL_USD >= 0 ? '+' : '-'}${formatUsd(Math.abs(assetPL_USD))})
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="font-bold text-slate-600">{percent}%</div>
                          {selectedFilter !== 'เงินสด (Cash)' && (
                              <div className="w-full max-w-[80px] h-1.5 bg-slate-100 rounded-full ml-auto mt-1 overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${barWidth}%` }}></div>
                              </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {selectedFilter !== 'เงินสด (Cash)' ? (
                            <>
                              <input 
                                  type="number" 
                                  value={targetVal}
                                  onChange={(e) => handleTargetChange(asset, e.target.value)}
                                  placeholder="0" 
                                  className="w-20 bg-white border border-slate-200 rounded-lg py-1 px-2 text-sm text-center focus:ring-2 focus:ring-emerald-300 outline-none text-slate-700 font-bold mb-1 shadow-sm mx-auto block"
                              />
                              {targetVal && (
                                  <div className={`text-[10px] font-bold ${diffClass}`}>
                                      {diffStatus}
                                  </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400 font-medium">ไม่มีข้อมูลสินทรัพย์</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section: Line Chart */}
      <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 flex flex-col">
        {/* Header Row: Title and Timeframe Buttons */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-slate-800 font-bold text-lg flex items-center gap-2">
             <i className="fa-solid fa-chart-area text-emerald-500"></i> Performance & Risk
          </h3>
          <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            {['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'].map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${timeframe === tf ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Row: 5 blocks spread equally */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8 bg-slate-50/50 p-6 rounded-2xl border border-slate-50">
          
          {/* Invested Capital */}
          <div className="flex flex-col">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">เงินลงทุน</p>
             <p className="text-lg font-extrabold text-slate-700">฿{formatThb(cards.investedCapitalTHB)}</p>
             <p className="text-xs font-medium text-slate-400 mt-0.5">(${formatUsd(cards.investedCapitalTHB / data.globalExchangeRate)})</p>
          </div>
          
          {/* Market Value */}
          <div className="flex flex-col border-l-0 md:border-l border-slate-200 md:pl-6">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">มูลค่าปัจจุบัน</p>
             <p className="text-lg font-extrabold text-slate-700">฿{formatThb(cards.totalWealthTHB)}</p>
             <p className="text-xs font-medium text-slate-400 mt-0.5">(${formatUsd(cards.totalWealthUSD)})</p>
          </div>

          {/* Period P/L */}
          <div className="flex flex-col border-l-0 md:border-l border-slate-200 md:pl-6">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">กำไร/ขาดทุน</p>
             <div className="flex items-center gap-2">
                <p className={`text-lg font-extrabold ${Math.abs(chart.periodPL_THB) < 0.01 ? 'text-slate-400' : (chart.periodPL_THB > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                   {chart.periodPL_THB >= 0 ? '+' : '-'}฿{formatThb(Math.abs(chart.periodPL_THB))}
                </p>
             </div>
             <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-xs font-medium ${Math.abs(chart.periodPL_THB) < 0.01 ? 'text-slate-400' : (chart.periodPL_THB > 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                   ({chart.periodPL_THB >= 0 ? '+' : '-'}${formatUsd(Math.abs(chart.periodPL_THB / data.globalExchangeRate))})
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${Math.abs(chart.periodPL_Pct) < 0.01 ? 'bg-slate-100 text-slate-500' : (chart.periodPL_Pct > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}`}>
                   {chart.periodPL_Pct >= 0 ? '+' : '-'}{Math.abs(chart.periodPL_Pct).toFixed(2)}%
                </span>
             </div>
          </div>

          {/* Max DD (%) */}
          <div className="flex flex-col border-l-0 md:border-l border-slate-200 md:pl-6">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Max Drawdown (%)</p>
             {selectedFilter === 'เงินสด (Cash)' ? (
                <div className="flex items-center gap-2">
                   <p className="text-lg font-extrabold text-slate-400">-</p>
                </div>
             ) : (
                <>
                   <div className="flex items-center gap-2">
                      <p className="text-lg font-extrabold text-rose-500">
                         -฿{formatThb(Math.abs(cards.maxDrawdownPct_THBAtTime))}
                      </p>
                   </div>
                   <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs font-medium text-rose-400">
                         (-${formatUsd(Math.abs(cards.maxDrawdownPct_THBAtTime / data.globalExchangeRate))})
                      </p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600">
                         -{Math.abs(cards.maxDrawdownPct).toFixed(2)}%
                      </span>
                   </div>
                </>
             )}
          </div>

          {/* Max DD (THB) */}
          <div className="flex flex-col border-l-0 md:border-l border-slate-200 md:pl-6">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Max Drawdown (เงิน)</p>
             {selectedFilter === 'เงินสด (Cash)' ? (
                <div className="flex items-center gap-2">
                   <p className="text-lg font-extrabold text-slate-400">-</p>
                </div>
             ) : (
                <>
                   <div className="flex items-center gap-2">
                      <p className="text-lg font-extrabold text-rose-500">
                         -฿{formatThb(Math.abs(cards.maxDrawdownTHB))}
                      </p>
                   </div>
                   <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs font-medium text-rose-400">
                         (-${formatUsd(Math.abs(cards.maxDrawdownTHB / data.globalExchangeRate))})
                      </p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600">
                         -{Math.abs(cards.maxDrawdownTHB_PctAtTime).toFixed(2)}%
                      </span>
                   </div>
                </>
             )}
          </div>

        </div>
        <div className="flex-1 relative min-h-[300px]">
          <Line 
            data={{
              labels: chart.labels,
              datasets: [
                {
                  label: 'Market Value',
                  data: chart.marketData,
                  borderColor: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderWidth: 2,
                  pointRadius: 0,
                  pointHoverRadius: 6,
                  fill: true,
                  tension: 0.1
                },
                {
                  label: 'Cost Basis',
                  data: chart.costData,
                  borderColor: '#64748B',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  fill: false,
                  tension: 0.1
                }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
                plugins: {
                  legend: { position: 'top', align: 'end', labels: { boxWidth: 12, usePointStyle: true, font: { family: "'Prompt', sans-serif", size: 13, weight: 'bold' } } },
                  tooltip: { 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      titleColor: '#1e293b', 
                      bodyColor: '#475569', 
                      borderColor: '#e2e8f0', 
                      borderWidth: 1, 
                      padding: 12, 
                      boxPadding: 6, 
                      usePointStyle: true, 
                      titleFont: { family: "'Prompt', sans-serif", size: 14 }, 
                      bodyFont: { family: "'Prompt', sans-serif", size: 14, weight: 'bold' },
                      callbacks: {
                          afterBody: function(tooltipItems) {
                              if (tooltipItems.length >= 2) {
                                  let market = tooltipItems[0].parsed.y;
                                  let cost = tooltipItems[1].parsed.y;
                                  let pl = market - cost;
                                  let pct = cost > 0 ? (pl / cost) * 100 : 0;
                                  let prefix = pl >= 0 ? '+' : '-';
                                  let emoji = pl >= 0 ? '🟢' : '🔴';
                                  
                                  let startMarket = tooltipItems[0].chart.data.datasets[0].data[0];
                                  let startCost = tooltipItems[0].chart.data.datasets[1].data[0];
                                  
                                  let isAllTime = data.dashboardStats?.chart?.isAllTime;
                                  
                                  if (isAllTime) {
                                      startMarket = 0;
                                      startCost = 0;
                                  }
                                  let flows = cost - startCost;
                                  let periodPL = market - startMarket - flows;
                                  
                                  let periodPct = 0;
                                  if (isAllTime) {
                                      periodPct = pct;
                                  } else {
                                      let adjustedStart = startMarket + (flows > 0 ? flows / 2 : flows);
                                      periodPct = adjustedStart > 0 ? (periodPL / adjustedStart) * 100 : 0;
                                      if (adjustedStart <= 0 && startMarket === 0 && market > 0) {
                                          periodPct = cost > 0 ? ((market - cost) / cost) * 100 : 0;
                                          periodPL = market - cost;
                                      }
                                  }
                                  let periodPrefix = periodPL >= 0 ? '+' : '-';
                                  let periodEmoji = periodPL >= 0 ? '🟢' : '🔴';
                                  
                                  return `\n${periodEmoji} กำไร/ขาดทุน (ช่วงนี้): ${periodPrefix}฿${new Intl.NumberFormat('en-US').format(Math.abs(periodPL))} (${periodPrefix}${Math.abs(periodPct).toFixed(2)}%)\n${emoji} กำไร/ขาดทุน (ทั้งหมด): ${prefix}฿${new Intl.NumberFormat('en-US').format(Math.abs(pl))} (${prefix}${Math.abs(pct).toFixed(2)}%)`;
                              }
                          }
                      }
                  }
                },
              scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { family: "'Prompt', sans-serif" } } },
                y: { grid: { color: '#f1f5f9', borderDash: [5, 5] }, ticks: { font: { family: "'Prompt', sans-serif" } } }
              }
            }}
          />
        </div>
      </div>

      {/* Bottom Section: Monthly Performance */}
      <section className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-regular fa-calendar-days text-emerald-400"></i> สรุปผลตอบแทน{monthlyView === 'monthly' ? 'รายเดือน' : 'สะสม'}
          </h3>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setMonthlyView('monthly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                monthlyView === 'monthly' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              รายเดือน
            </button>
            <button
              onClick={() => setMonthlyView('cumulative')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                monthlyView === 'cumulative' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              สะสม
            </button>
          </div>
        </div>
        
        {monthlyPerformance && monthlyPerformance.length > 0 && (
          <div className="p-6 border-b border-slate-50">
            <div className="h-64 w-full">
              <Bar 
                key={monthlyView}
                data={monthlyChartData} 
                options={monthlyChartOptions} 
                plugins={[{
                  id: 'barLabels',
                  afterDatasetsDraw(chart) {
                    const { ctx } = chart;
                    chart.data.datasets.forEach((dataset, i) => {
                      const meta = chart.getDatasetMeta(i);
                      if (meta.type !== 'bar') return;
                      
                      meta.data.forEach((element, index) => {
                        const pct = dataset.pctData ? (dataset.pctData[index] || 0) : 0;
                        
                        if (Math.abs(pct) < 0.01 && pct !== 0) return; // Skip very small numbers visually
                        
                        ctx.fillStyle = pct >= 0 ? '#059669' : '#e11d48'; // emerald-600 / rose-600
                        const fontSize = 10;
                        ctx.font = `bold ${fontSize}px "Prompt", sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        
                        const dataPoint = dataset.data[index];
                        const padding = 12;
                        const position = element.tooltipPosition();
                        
                        const text = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
                        const yPos = dataPoint >= 0 ? position.y - padding : position.y + padding;
                        
                        ctx.fillText(text, position.x, yPos);
                      });
                    });
                  }
                }]}
              />
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto px-6 pb-6 mt-4">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-emerald-50/80 backdrop-blur-sm z-10">
              <tr className="text-emerald-900 font-bold border-b border-emerald-100 whitespace-nowrap">
                <th className="p-4 uppercase tracking-wider text-sm rounded-tl-xl">เดือน</th>
                <th className="p-4 uppercase tracking-wider text-sm text-right">เงินลงทุน</th>
                <th className="p-4 uppercase tracking-wider text-sm text-right">มูลค่าพอร์ต</th>
                <th className="p-4 uppercase tracking-wider text-sm text-right">กำไร/ขาดทุน</th>
                <th className="p-4 uppercase tracking-wider text-sm text-right">ผลตอบแทน (%)</th>
                <th className="p-4 uppercase tracking-wider text-sm text-right">กำไร/ขาดทุน สะสม</th>
                <th className="p-4 uppercase tracking-wider text-sm text-right rounded-tr-xl">ผลตอบแทน สะสม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlyPerformance && monthlyPerformance.length > 0 ? (
                monthlyPerformance.map((item, idx) => {
                  let dateObj = new Date(item.month + "-01");
                  let monthName = dateObj.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
                  
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group whitespace-nowrap">
                      <td className="p-4 text-slate-600 font-bold">{monthName}</td>
                      <td className="p-4 text-right font-medium text-slate-600">฿{formatThb(item.investedTHB)}</td>
                      <td className="p-4 text-right font-medium text-slate-600">฿{formatThb(item.marketTHB)}</td>
                      <td className={`p-4 font-bold text-right ${Math.abs(item.plTHB) < 0.01 ? 'text-slate-400' : (item.plTHB > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                        {item.plTHB >= 0 ? '+' : '-'}฿{formatThb(Math.abs(item.plTHB))}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${Math.abs(item.plPct) < 0.01 ? 'bg-slate-100 text-slate-500' : (item.plPct > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}`}>
                          {item.plPct >= 0 ? '+' : '-'}{Math.abs(item.plPct).toFixed(2)}%
                        </span>
                      </td>
                      <td className={`p-4 font-bold text-right ${Math.abs(item.cumulativePL) < 0.01 ? 'text-slate-400' : (item.cumulativePL > 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                        {item.cumulativePL >= 0 ? '+' : '-'}฿{formatThb(Math.abs(item.cumulativePL))}
                      </td>
                      <td className={`p-4 font-extrabold text-right ${Math.abs(item.cumulativePct) < 0.01 ? 'text-slate-400' : (item.cumulativePct > 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                        {item.cumulativePct >= 0 ? '+' : '-'}{Math.abs(item.cumulativePct).toFixed(2)}%
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400 font-medium">ไม่มีข้อมูลรายเดือน</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};

export default Dashboard;
