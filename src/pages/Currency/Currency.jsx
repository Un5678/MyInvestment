import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { submitData } from '../../services/api';

const Currency = () => {
  const { loading, data, currencyStats, refreshData } = useData();
  const [filterType, setFilterType] = useState('all');
  
  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formType, setFormType] = useState('Buy USD');
  const [formAmount, setFormAmount] = useState('');
  const [targetRate, setTargetRate] = useState('');
  const [formRate, setFormRate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading && data.currencyData.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const formatThb = (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filteredCurrency = (filterType === 'all' 
    ? data.currencyData 
    : data.currencyData.filter(item => item.type === filterType)).slice().reverse();

  const calculateAdjustment = () => {
    const tRate = parseFloat(targetRate);
    if (targetRate === '' || isNaN(tRate)) return { usd: 0, thb: 0, impossible: false };
    if (tRate <= 0) return { usd: 0, thb: 0, impossible: true };
    const actualRate = data?.globalExchangeRate || 0;
    const totalUSD = currencyStats?.totalUSD || 0;
    const totalTHB = currencyStats?.totalTHBCost || 0;
    const currentAvg = totalUSD > 0 ? (totalTHB / totalUSD) : 0;
    if (Math.abs(currentAvg - tRate) < 0.0001) return { usd: 0, thb: 0, impossible: false };
    if (actualRate === tRate) return { usd: 0, thb: 0, impossible: true };
    const addUSD = (tRate * totalUSD - totalTHB) / (actualRate - tRate);
    const addTHB = addUSD * actualRate;
    const impossible = addUSD < 0;
    return { usd: addUSD, thb: addTHB, impossible };
  };

  const adj = calculateAdjustment();

  const calculateResult = () => {
    const amt = parseFloat(formAmount) || 0;
    const rate = parseFloat(formRate) || 0;
    if (rate === 0) return '0.00';
    if (formType === 'Buy USD') {
        return (amt / rate).toFixed(2);
    } else {
        return (amt * rate).toFixed(2);
    }
  };

  const handleSave = async () => {
    if (!formDate || !formAmount || !formRate) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }
    setIsSubmitting(true);
    try {
        await submitData({
            action: 'saveCurrency',
            date: formDate,
            type: formType,
            amount: formAmount,
            exchangeRate: formRate,
            convertedAmount: calculateResult(),
            rowIndex: ''
        });
        setFormAmount('');
        setFormRate('');
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
        // Find actual row index. In original data, index starts at 0. Google sheets row index is usually index + 2
        // Assuming the backend expects `rowIndex` relative to data array:
        const item = filteredCurrency[index];
        const originalIndex = data.currencyData.indexOf(item);
        
        await submitData({
            action: 'delete',
            sheetName: 'CurrencyLog',
            rowIndex: originalIndex + 2
        });
        await refreshData();
    } catch (err) {
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Portfolio Stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-inner">
                <i className="fa-solid fa-wallet"></i>
              </div>
              <h3 className="text-lg font-bold text-slate-800">ยอดเงินในพอร์ต</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">THB</p>
                <p className="text-lg font-bold text-slate-700">฿{currencyStats ? formatThb(currencyStats.currentTHB) : '0.00'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">USD</p>
                <p className="text-lg font-bold text-slate-700">${currencyStats ? formatThb(currencyStats.totalUSD) : '0.00'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Average Rate</p>
                <p className="text-lg font-bold text-indigo-500">฿{currencyStats ? formatThb(currencyStats.averageRate) : '0.00'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-5 border-b border-slate-50 pb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shadow-inner">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <h3 className="text-lg font-bold text-slate-800">กำไร / ขาดทุน พอร์ตเงินสด</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">THB</p>
                <p className={`text-lg font-bold ${currencyStats?.plTHB >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {currencyStats?.plTHB >= 0 ? '+' : '-'}฿{currencyStats ? formatThb(Math.abs(currencyStats.plTHB)) : '0.00'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">USD</p>
                <p className={`text-lg font-bold ${currencyStats?.plUSD >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {currencyStats?.plUSD >= 0 ? '+' : '-'}${currencyStats ? formatThb(Math.abs(currencyStats.plUSD)) : '0.00'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Growth</p>
                <p className={`text-sm mt-0.5 font-bold inline-block px-2 py-0.5 rounded-lg ${currencyStats?.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {currencyStats?.growth >= 0 ? '+' : ''}{currencyStats ? currencyStats.growth.toFixed(2) : '0.00'}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target & Plan */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 mb-4 tracking-wide uppercase"><i className="fa-solid fa-crosshairs text-indigo-400 mr-2"></i>เป้าหมาย Rate USD</p>
          <div className="space-y-4">
              <div className="flex justify-between items-center text-sm gap-4">
                <span className="text-slate-500 font-medium">Target Rate</span>
                <input type="number" value={targetRate} onChange={e => setTargetRate(e.target.value)} placeholder="0.00" className="w-28 bg-slate-50 border border-slate-100 rounded-xl p-2 text-right focus:ring-2 focus:ring-indigo-300 outline-none font-bold text-slate-700 shadow-inner" />
              </div>
            <div className="flex justify-between items-center text-sm gap-4">
              <span className="text-slate-500 font-medium">Actual Rate</span>
              <div className="w-28 bg-slate-50 border border-slate-100 rounded-xl p-2 text-right font-bold text-slate-700">
                {data.globalExchangeRate ? data.globalExchangeRate.toFixed(2) : '0.00'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 mb-4 tracking-wide uppercase"><i className="fa-solid fa-calculator text-emerald-400 mr-2"></i>แผนปรับต้นทุน</p>
          {adj.impossible && targetRate !== '' ? (
            <div className="flex-1 flex items-center justify-center p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 font-bold text-sm text-center shadow-inner">
              <i className="fa-solid fa-circle-exclamation mr-2"></i> ไม่สามารถถัวเฉลี่ยได้
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center text-sm gap-4">
                <span className="text-slate-400 font-bold w-6 text-right text-lg">$</span>
                <div className={`flex-1 font-bold rounded-xl p-2 text-right border shadow-inner ${!targetRate ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                  {!targetRate ? '-' : adj.usd.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
              </div>
              <div className="flex items-center text-sm gap-4">
                <span className="text-slate-400 font-bold w-6 text-right text-lg">฿</span>
                <div className={`flex-1 font-bold rounded-xl p-2 text-right border shadow-inner ${!targetRate ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                  {!targetRate ? '-' : adj.thb.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
            <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 shadow-inner">
              <i className="fa-solid fa-money-bill-transfer"></i>
            </div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight uppercase tracking-wide">Realized P/L<br/><span className="text-[10px] text-slate-400 font-medium normal-case">จากการแลกเปลี่ยน</span></h3>
          </div>
          <div>
            <p className={`text-3xl font-extrabold tracking-tight ${currencyStats?.totalRealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {currencyStats?.totalRealizedPL >= 0 ? '+' : '-'}฿{currencyStats ? formatThb(Math.abs(currencyStats.totalRealizedPL)) : '0.00'}
            </p>
          </div>
        </div>
      </section>

      {/* Entry Form */}
      <section className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
           <i className="fa-solid fa-plus-circle text-emerald-500"></i> บันทึกการแลกเปลี่ยนเงิน
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">วันที่</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-bold" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">ประเภท</label>
                <select value={formType} onChange={e => setFormType(e.target.value)} className={`w-full border-none rounded-xl p-2.5 text-sm font-bold outline-none cursor-pointer transition-colors ${formType === 'Buy USD' ? 'bg-emerald-100 text-emerald-700 focus:ring-2 focus:ring-emerald-300' : 'bg-rose-100 text-rose-700 focus:ring-2 focus:ring-rose-300'}`}>
                    <option value="Buy USD" className="bg-emerald-500 text-white font-bold">Buy USD</option>
                    <option value="Sell USD" className="bg-rose-500 text-white font-bold">Sell USD</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">{formType === 'Buy USD' ? 'THB ที่ใช้แลก' : 'USD ที่ขาย'}</label>
                <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-bold" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">อัตราแลกเปลี่ยน</label>
                <input type="number" value={formRate} onChange={e => setFormRate(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-300 outline-none text-slate-700 font-bold" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">{formType === 'Buy USD' ? 'USD ที่ได้' : 'THB ที่ได้'}</label>
                <input type="text" value={calculateResult()} className="w-full bg-emerald-50 border-none rounded-xl p-2.5 text-sm outline-none text-emerald-700 font-bold" readOnly />
            </div>
            <div>
                <button onClick={handleSave} disabled={isSubmitting} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-save"></i> บันทึก</>}
                </button>
            </div>
        </div>
      </section>

      {/* Currency History Table */}
      <section className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-emerald-500"></i> ตารางประวัติการแลกเปลี่ยนเงิน
          </h3>
          <div className="relative w-48">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2 px-4 pr-8 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-sm shadow-sm"
            >
              <option value="all">ทั้งหมด (All)</option>
              <option value="Buy USD">Buy USD</option>
              <option value="Sell USD">Sell USD</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-indigo-400">
              <i className="fa-solid fa-filter text-xs"></i>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-6 pb-6 mt-4">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-emerald-50 text-emerald-700 font-bold border-b border-emerald-100">
                <th className="p-4 uppercase tracking-wider text-xs">วันที่</th>
                <th className="p-4 uppercase tracking-wider text-xs">ประเภท</th>
                <th className="p-4 uppercase tracking-wider text-xs text-right">จำนวนเงิน</th>
                <th className="p-4 uppercase tracking-wider text-xs text-right">อัตราแลกเปลี่ยน</th>
                <th className="p-4 uppercase tracking-wider text-xs text-right">จำนวนเงินที่ได้</th>
                <th className="p-4 uppercase tracking-wider text-xs text-center">ลบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCurrency.length > 0 ? (
                filteredCurrency.map((item, idx) => {
                  let typeClass = item.type === 'Buy USD' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'bg-rose-100 text-rose-600 shadow-sm';
                  let displayDate = item.date;
                  if (displayDate.includes('T')) displayDate = displayDate.split('T')[0];

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4 text-slate-500 font-medium">{displayDate}</td>
                      <td className="p-4">
                        <span className={`${typeClass} px-3 py-1 rounded-lg text-xs font-bold shadow-sm`}>{item.type}</span>
                      </td>
                      <td className="p-4 text-slate-600 font-medium text-right">{item.type === 'Buy USD' ? '฿' : '$'}{parseFloat(item.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 text-slate-600 font-medium text-right">{parseFloat(item.rate).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="p-4 font-bold text-slate-700 text-right">{item.type === 'Buy USD' ? '$' : '฿'}{parseFloat(item.converted).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
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
                  <td colSpan="6" className="p-8 text-center text-slate-400 font-medium">ไม่พบข้อมูลประวัติค่าเงิน</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Currency;
