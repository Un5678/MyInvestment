import React from 'react';

const Header = ({ activeTab, setActiveTab }) => {
  const activeClass = "px-6 py-2.5 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm transition-colors";
  const inactiveClass = "px-6 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-green-800 rounded-xl transition-all";

  return (
    <header className="bg-green-100/90 backdrop-blur-xl border-b border-green-200 sticky top-0 z-50 shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-2xl font-extrabold bg-gradient-to-r from-green-800 to-emerald-500 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
          My Investment
        </div>
        
        <nav className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 gap-1">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={activeTab === 'dashboard' ? activeClass : inactiveClass}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('tradelog')} 
            className={activeTab === 'tradelog' ? activeClass : inactiveClass}
          >
            Trade Log
          </button>
          <button 
            onClick={() => setActiveTab('currency')} 
            className={activeTab === 'currency' ? activeClass : inactiveClass}
          >
            Currency Log
          </button>
          <button 
            onClick={() => setActiveTab('screener')} 
            className={activeTab === 'screener' ? activeClass : inactiveClass}
          >
            Stock Screener
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
