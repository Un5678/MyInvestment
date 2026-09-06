import { useState } from 'react';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard/Dashboard';
import TradeLog from './pages/TradeLog/TradeLog';
import Currency from './pages/Currency/Currency';
import Screener from './pages/Screener/Screener';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="bg-[#f0fdf4] text-slate-700 min-h-screen font-sans">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'tradelog' && <TradeLog />}
        {activeTab === 'currency' && <Currency />}
        {activeTab === 'screener' && <Screener />}
      </div>
    </div>
  );
}

export default App;
