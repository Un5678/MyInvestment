import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchCurrencyData, fetchTradeData, fetchMarketData, fetchPriceHistory } from '../services/api';
import { calculateCurrencyStats, calculateTradeStats, processDashboardData } from '../utils/calculations';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [selectedFilter, setSelectedFilter] = useState('สินทรัพย์ทั้งหมด (Total Wealth)');
  const [timeframe, setTimeframe] = useState('YTD');
  const [viewMode, setViewMode] = useState('grouped');

  const getInitialData = () => {
    const cachedCurrency = localStorage.getItem('currencyData');
    const cachedTrade = localStorage.getItem('tradeData');
    const cachedMarket = localStorage.getItem('marketData');
    const cachedPrice = localStorage.getItem('priceHistory');

    if (cachedCurrency && cachedTrade && cachedMarket) {
        return {
            currencyData: JSON.parse(cachedCurrency),
            tradeData: JSON.parse(cachedTrade),
            marketMap: JSON.parse(cachedMarket).marketMap,
            globalExchangeRate: JSON.parse(cachedMarket).globalExchangeRate,
            priceHistory: cachedPrice ? JSON.parse(cachedPrice) : []
        };
    }
    return {
        currencyData: [],
        tradeData: [],
        marketMap: {},
        globalExchangeRate: 35.0,
        priceHistory: []
    };
  };

  const initialData = getInitialData();
  const [data, setData] = useState(initialData);

  // Initialize stats synchronously if we have cached data
  const [dashboardStats, setDashboardStats] = useState(() => {
      if (initialData.tradeData.length > 0) {
          return processDashboardData(initialData.tradeData, initialData.marketMap, initialData.priceHistory, initialData.globalExchangeRate, 'สินทรัพย์ทั้งหมด (Total Wealth)', 'YTD', 'grouped');
      }
      return null;
  });
  const [tradeStats, setTradeStats] = useState(() => {
      if (initialData.tradeData.length > 0) {
          return calculateTradeStats(initialData.tradeData, initialData.globalExchangeRate);
      }
      return null;
  });
  const [currencyStats, setCurrencyStats] = useState(() => {
      if (initialData.currencyData.length > 0) {
          return calculateCurrencyStats(initialData.currencyData, initialData.globalExchangeRate);
      }
      return null;
  });

  // Only show loading initially if we don't have dashboardStats
  const [loading, setLoading] = useState(!initialData.tradeData.length);

  const loadAllData = async () => {
    // Only set loading if we don't have stats yet
    setLoading(prev => dashboardStats ? false : true);
    
    try {
      // Fetch fresh data
      const [currRes, tradeRes, marketRes, priceRes] = await Promise.all([
        fetchCurrencyData(),
        fetchTradeData(),
        fetchMarketData(),
        fetchPriceHistory()
      ]);
      
      const newData = {
        currencyData: currRes,
        tradeData: tradeRes,
        marketMap: marketRes.marketMap,
        globalExchangeRate: marketRes.globalExchangeRate,
        priceHistory: priceRes
      };
      
      setData(newData);

      // 3. Update cache
      localStorage.setItem('currencyData', JSON.stringify(currRes));
      localStorage.setItem('tradeData', JSON.stringify(tradeRes));
      localStorage.setItem('marketData', JSON.stringify(marketRes));
      localStorage.setItem('priceHistory', JSON.stringify(priceRes));

    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Update computed stats whenever data or filters change
  useEffect(() => {
    if (data.currencyData.length > 0) {
       setCurrencyStats(calculateCurrencyStats(data.currencyData, data.globalExchangeRate));
    }
    
    if (data.tradeData.length > 0) {
       setTradeStats(calculateTradeStats(data.tradeData, data.globalExchangeRate));
    }

    if (data.tradeData.length > 0) {
       setDashboardStats(processDashboardData(
         data.tradeData,
         data.marketMap,
         data.priceHistory,
         data.globalExchangeRate,
         selectedFilter,
         timeframe,
         viewMode
       ));
    }
  }, [data, selectedFilter, timeframe, viewMode]);

  const refreshData = async () => {
    await loadAllData();
  };

  return (
    <DataContext.Provider value={{
      loading,
      data,
      selectedFilter, setSelectedFilter,
      timeframe, setTimeframe,
      viewMode, setViewMode,
      dashboardStats,
      tradeStats,
      currencyStats,
      refreshData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
