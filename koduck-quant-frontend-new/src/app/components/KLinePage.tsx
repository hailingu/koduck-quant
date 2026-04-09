import { useState } from "react";
import { TrendingUp, TrendingDown, Calendar, ZoomIn, ZoomOut, Camera } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function KLinePage() {
  const [activeTimeframe, setActiveTimeframe] = useState("intraday");

  // Mock price data
  const priceData = [
    { time: "09:30", price: 62840, vwap: 62850 },
    { time: "10:00", price: 62950, vwap: 62900 },
    { time: "10:30", price: 62800, vwap: 62880 },
    { time: "11:00", price: 63100, vwap: 62920 },
    { time: "11:30", price: 63000, vwap: 62950 },
    { time: "12:00", price: 63250, vwap: 63000 },
    { time: "12:30", price: 63150, vwap: 63050 },
    { time: "13:00", price: 63400, vwap: 63100 },
    { time: "13:30", price: 63300, vwap: 63150 },
    { time: "14:00", price: 63492, vwap: 63200 },
  ];

  // Mock volume data
  const volumeData = [
    { time: "09:30", volume: 120 },
    { time: "10:00", volume: 180 },
    { time: "10:30", volume: 240 },
    { time: "11:00", volume: 150 },
    { time: "11:30", volume: 200 },
    { time: "12:00", volume: 280 },
    { time: "12:30", volume: 160 },
    { time: "13:00", volume: 220 },
    { time: "13:30", volume: 140 },
    { time: "14:00", volume: 190 },
  ];

  // Mock live trades
  const liveTrades = [
    { time: "14:02:11", price: 63492.10, amount: 0.421, type: "buy" },
    { time: "14:02:10", price: 63491.95, amount: 1.220, type: "sell" },
    { time: "14:02:08", price: 63492.05, amount: 0.015, type: "buy" },
    { time: "14:02:07", price: 63492.20, amount: 5.842, type: "buy" },
    { time: "14:02:05", price: 63491.50, amount: 0.050, type: "sell" },
    { time: "14:02:02", price: 63491.90, amount: 0.118, type: "buy" },
    { time: "14:02:00", price: 63491.20, amount: 2.440, type: "sell" },
    { time: "14:01:58", price: 63491.80, amount: 0.992, type: "buy" },
    { time: "14:01:55", price: 63491.10, amount: 0.022, type: "sell" },
    { time: "14:01:52", price: 63490.95, amount: 1.050, type: "sell" },
  ];

  const currentPrice = 63492.10;
  const high = 64210.00;
  const low = 62840.50;
  const volume = "14.2B";
  const change = -2.41;
  const isPositive = change > 0;

  const timeframes = [
    { id: "intraday", label: "Intraday" },
    { id: "1min", label: "1 Min" },
    { id: "5min", label: "5 Min" },
    { id: "1hour", label: "1 Hour" },
    { id: "daily", label: "Daily" },
  ];

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Top Bar */}
      <header className="bg-white flex-shrink-0">
        <div className="px-8 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-medium text-gray-900">BTC/USDT</h1>
                <span className={`text-xs px-2 py-1 rounded ${
                  isPositive ? 'bg-[#10a37f]/10 text-[#10a37f]' : 'bg-red-50 text-red-600'
                }`}>
                  {isPositive ? '+' : ''}{change}%
                </span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-2xl font-medium text-[#10a37f]">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>High: ${high.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span>Low: ${low.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span>Vol: {volume}</span>
                </div>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              <Calendar className="w-4 h-4" />
              Annual Data
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-6 p-8">
          {/* Left: Chart Area */}
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            {/* Main Chart */}
            <div className="flex-1 min-h-0 bg-white hover:bg-gray-50/50 rounded-2xl transition-colors p-6 relative">
              {/* Timeframe Selector */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
                {timeframes.map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setActiveTimeframe(tf.id)}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                      activeTimeframe === tf.id
                        ? 'bg-[#10a37f] text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-[#10a37f]"></span>
                  <span className="text-xs text-gray-600">Price: {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-amber-500"></span>
                  <span className="text-xs text-gray-600">VWAP: 63,410.45</span>
                </div>
              </div>
              <div className="h-[calc(100%-9rem)]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceData}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10a37f" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10a37f" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="time" 
                      stroke="#9ca3af"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      style={{ fontSize: '12px' }}
                      domain={['dataMin - 100', 'dataMax + 100']}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="vwap" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#10a37f" 
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorPrice)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Chart Controls */}
              <div className="absolute bottom-6 right-6 flex gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ZoomIn className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ZoomOut className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Camera className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Volume Chart */}
            <div className="h-40 bg-white hover:bg-gray-50/50 rounded-2xl transition-colors p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="volume" fill="#10a37f" opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Live Data & Stats */}
          <div className="w-80 flex flex-col gap-6">
            {/* Time & Sales */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-900">Time & Sales</h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#10a37f] animate-pulse"></span>
                  <span className="text-xs text-gray-500">Live Stream</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {liveTrades.map((trade, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <span className="text-gray-500 w-16">{trade.time}</span>
                    <span className={`font-medium w-24 text-right ${
                      trade.type === 'buy' ? 'text-[#10a37f]' : 'text-red-500'
                    }`}>
                      {trade.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`w-20 text-right ${
                      trade.type === 'buy' ? 'text-[#10a37f]' : 'text-red-500'
                    }`}>
                      {trade.amount.toFixed(3)} BTC
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Statistics */}
            <div className="space-y-4 p-6 hover:bg-gray-50 rounded-2xl transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">1m Candle Aggregation</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10a37f]"></div>
                </label>
              </div>
              
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Network Latency</span>
                  <span className="text-xs font-medium text-gray-900">12ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Depth Concentration</span>
                  <span className="text-xs font-medium text-gray-900">0.842</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Liquid Flow Index</span>
                  <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="bg-[#10a37f] h-full w-[70%] rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}