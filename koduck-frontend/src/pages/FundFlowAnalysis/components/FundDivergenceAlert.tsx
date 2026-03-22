import React, { useState, useEffect, useCallback } from 'react';

// Types
interface DivergenceAlert {
  id: string;
  type: 'fake_breakout' | 'golden_pit' | 'accumulation' | 'distribution' | 'retail_trap';
  priority: 'critical' | 'high' | 'medium' | 'low';
  symbol: string;
  name: string;
  sector: string;
  priceChange: number;
  mainForceFlow: number;
  description: string;
  recommendation: string;
  triggeredAt: string;
  confidence: number;
}

// Mock data
const mockAlerts: DivergenceAlert[] = [
  {
    id: '1',
    type: 'golden_pit',
    priority: 'high',
    symbol: '601012',
    name: '隆基绿能',
    sector: '新能源',
    priceChange: -3.2,
    mainForceFlow: 1800000000,
    description: '价格下跌3.2%，但主力资金流入18亿，可能是黄金坑机会',
    recommendation: '关注低吸机会，建议分批建仓',
    triggeredAt: '14:22:05',
    confidence: 0.85,
  },
  {
    id: '2',
    type: 'fake_breakout',
    priority: 'critical',
    symbol: '000001',
    name: '平安银行',
    sector: '银行',
    priceChange: 4.5,
    mainForceFlow: -800000000,
    description: '价格大涨4.5%，但主力资金净流出8亿，假突破风险',
    recommendation: '建议减仓，谨防回调',
    triggeredAt: '13:58:12',
    confidence: 0.92,
  },
  {
    id: '3',
    type: 'retail_trap',
    priority: 'critical',
    symbol: '300750',
    name: '宁德时代',
    sector: '新能源',
    priceChange: 2.8,
    mainForceFlow: -1200000000,
    description: '散户大量买入30亿，主力暗中出货12亿',
    recommendation: '⚠️ 危险信号，建议立即减仓',
    triggeredAt: '13:45:30',
    confidence: 0.88,
  },
  {
    id: '4',
    type: 'accumulation',
    priority: 'medium',
    symbol: '600519',
    name: '贵州茅台',
    sector: '消费',
    priceChange: 0.5,
    mainForceFlow: 2500000000,
    description: '横盘震荡5天，主力资金持续流入25亿，吸筹迹象明显',
    recommendation: '关注突破机会',
    triggeredAt: '12:15:44',
    confidence: 0.76,
  },
  {
    id: '5',
    type: 'distribution',
    priority: 'high',
    symbol: '000858',
    name: '五粮液',
    sector: '消费',
    priceChange: -0.8,
    mainForceFlow: -1800000000,
    description: '价格滞涨，主力连续3天派发筹码18亿',
    recommendation: '建议减仓观望',
    triggeredAt: '11:30:15',
    confidence: 0.81,
  },
];

// Alert type config
const alertTypeConfig = {
  fake_breakout: { label: '假突破预警', icon: 'trending_up', color: 'text-red-500' },
  golden_pit: { label: '黄金坑预警', icon: 'trending_down', color: 'text-amber-400' },
  accumulation: { label: '吸筹信号', icon: 'savings', color: 'text-cyan-400' },
  distribution: { label: '出货预警', icon: 'warning', color: 'text-orange-500' },
  retail_trap: { label: '散户接盘', icon: 'dangerous', color: 'text-red-600' },
};

// Priority config
const priorityConfig = {
  critical: { 
    label: '紧急', 
    bgColor: 'bg-red-500/20', 
    borderColor: 'border-red-500',
    badgeColor: 'bg-red-500',
    animation: 'animate-pulse',
  },
  high: { 
    label: '重要', 
    bgColor: 'bg-amber-500/20', 
    borderColor: 'border-amber-500',
    badgeColor: 'bg-amber-500',
    animation: 'golden-pulse',
  },
  medium: { 
    label: '关注', 
    bgColor: 'bg-cyan-500/20', 
    borderColor: 'border-cyan-500',
    badgeColor: 'bg-cyan-500',
    animation: '',
  },
  low: { 
    label: '提示', 
    bgColor: 'bg-slate-700/50', 
    borderColor: 'border-slate-600',
    badgeColor: 'bg-slate-500',
    animation: '',
  },
};

// Format currency
function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 100000000) {
    return `${(absValue / 100000000).toFixed(1)}亿`;
  }
  if (absValue >= 10000) {
    return `${(absValue / 10000).toFixed(1)}万`;
  }
  return `${absValue}`;
}

// Alert Card Component
function AlertCard({ 
  alert, 
  onDismiss, 
  onAction 
}: { 
  alert: DivergenceAlert; 
  onDismiss: (id: string) => void;
  onAction: (alert: DivergenceAlert, action: string) => void;
}) {
  const typeConfig = alertTypeConfig[alert.type];
  const priorityConfigItem = priorityConfig[alert.priority];
  const isGoldenPit = alert.type === 'golden_pit';
  
  return (
    <div 
      className={`
        relative p-4 rounded-lg border-l-4 ${priorityConfigItem.borderColor} ${priorityConfigItem.bgColor}
        ${priorityConfigItem.animation} transition-all duration-300 hover:shadow-lg
        ${isGoldenPit ? 'shadow-amber-500/20' : ''}
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined ${typeConfig.color}`}>
            {typeConfig.icon}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${priorityConfigItem.badgeColor}`}>
            {priorityConfigItem.label}
          </span>
          <span className="text-xs text-slate-400">{alert.triggeredAt}</span>
        </div>
        <button 
          onClick={() => onDismiss(alert.id)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
      
      {/* Stock Info */}
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-slate-800 px-3 py-1.5 rounded">
          <span className="font-bold text-slate-200">{alert.symbol}</span>
        </div>
        <div>
          <div className="font-medium text-slate-200">{alert.name}</div>
          <div className="text-xs text-slate-500">{alert.sector}</div>
        </div>
        <div className="ml-auto text-right">
          <div className={`font-mono text-sm ${alert.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {alert.priceChange >= 0 ? '+' : ''}{alert.priceChange.toFixed(2)}%
          </div>
          <div className={`text-xs ${alert.mainForceFlow >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
            主力{alert.mainForceFlow >= 0 ? '+' : '-'}{formatCurrency(alert.mainForceFlow)}
          </div>
        </div>
      </div>
      
      {/* Alert Type Label */}
      <div className={`text-sm font-bold mb-2 ${typeConfig.color}`}>
        {typeConfig.label}
      </div>
      
      {/* Description */}
      <p className="text-sm text-slate-300 mb-3 leading-relaxed">
        {alert.description}
      </p>
      
      {/* Recommendation */}
      <div className="bg-slate-900/50 p-2 rounded mb-3">
        <div className="text-[10px] text-slate-500 uppercase mb-1">操作建议</div>
        <div className="text-xs text-slate-300">{alert.recommendation}</div>
      </div>
      
      {/* Footer */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">置信度</span>
          <div className="w-16 bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${alert.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{(alert.confidence * 100).toFixed(0)}%</span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button 
            onClick={() => onAction(alert, 'details')}
            className="text-[10px] font-medium px-2 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
          >
            详情
          </button>
          {alert.type === 'golden_pit' && (
            <button 
              onClick={() => onAction(alert, 'buy')}
              className="text-[10px] font-bold px-2 py-1 bg-amber-500 text-slate-900 rounded hover:bg-amber-400 transition-colors"
            >
              买入
            </button>
          )}
          {(alert.type === 'fake_breakout' || alert.type === 'retail_trap') && (
            <button 
              onClick={() => onAction(alert, 'sell')}
              className="text-[10px] font-bold px-2 py-1 bg-red-500 text-white rounded hover:bg-red-400 transition-colors"
            >
              卖出
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Alert Stats Component
function AlertStats({ alerts }: { alerts: DivergenceAlert[] }) {
  const stats = {
    critical: alerts.filter(a => a.priority === 'critical').length,
    high: alerts.filter(a => a.priority === 'high').length,
    medium: alerts.filter(a => a.priority === 'medium').length,
    low: alerts.filter(a => a.priority === 'low').length,
  };

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      <div className="bg-red-500/10 border border-red-500/30 p-2 rounded text-center">
        <div className="text-lg font-bold text-red-500">{stats.critical}</div>
        <div className="text-[10px] text-slate-400">紧急</div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded text-center">
        <div className="text-lg font-bold text-amber-500">{stats.high}</div>
        <div className="text-[10px] text-slate-400">重要</div>
      </div>
      <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded text-center">
        <div className="text-lg font-bold text-cyan-500">{stats.medium}</div>
        <div className="text-[10px] text-slate-400">关注</div>
      </div>
      <div className="bg-slate-700/50 border border-slate-600/30 p-2 rounded text-center">
        <div className="text-lg font-bold text-slate-400">{stats.low}</div>
        <div className="text-[10px] text-slate-400">提示</div>
      </div>
    </div>
  );
}

export function FundDivergenceAlert() {
  const [alerts, setAlerts] = useState<DivergenceAlert[]>(mockAlerts);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showRealTime, setShowRealTime] = useState(true);
  const [newAlertId, setNewAlertId] = useState<string | null>(null);

  // Simulate real-time alerts
  useEffect(() => {
    if (!showRealTime) return;

    const interval = setInterval(() => {
      // Randomly add a new alert (10% chance every 30 seconds)
      if (Math.random() < 0.1) {
        const newAlert: DivergenceAlert = {
          id: Date.now().toString(),
          type: 'golden_pit',
          priority: 'high',
          symbol: '000001',
          name: '平安银行',
          sector: '银行',
          priceChange: -2.5,
          mainForceFlow: 1200000000,
          description: '价格回调但主力资金持续流入',
          recommendation: '关注低吸机会',
          triggeredAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          confidence: 0.82,
        };
        setAlerts(prev => [newAlert, ...prev]);
        setNewAlertId(newAlert.id);
        
        // Clear highlight after 3 seconds
        setTimeout(() => setNewAlertId(null), 3000);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [showRealTime]);

  const filteredAlerts = alerts.filter(alert => {
    if (filterPriority && alert.priority !== filterPriority) return false;
    if (filterType && alert.type !== filterType) return false;
    return true;
  });

  const handleDismiss = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleAction = useCallback((alert: DivergenceAlert, action: string) => {
    console.log(`Action: ${action} for ${alert.symbol}`);
    // TODO: Implement actual action
  }, []);

  const handleClearAll = () => {
    setAlerts([]);
  };

  return (
    <div className="glass-panel p-6 rounded-xl h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-headline font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">crisis_alert</span>
            资金背离预警
          </h2>
          <p className="text-xs text-slate-400 mt-1">实时监控价格与资金流向背离</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRealTime(!showRealTime)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showRealTime ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {showRealTime ? '● 实时监控' : '○ 已暂停'}
          </button>
          <button
            onClick={handleClearAll}
            className="text-xs px-2 py-1 bg-slate-700 text-slate-400 rounded hover:bg-slate-600 transition-colors"
          >
            清空
          </button>
        </div>
      </div>

      {/* Stats */}
      <AlertStats alerts={alerts} />

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select 
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 flex-1"
          value={filterPriority || ''}
          onChange={(e) => setFilterPriority(e.target.value || null)}
        >
          <option value="">全部级别</option>
          <option value="critical">紧急</option>
          <option value="high">重要</option>
          <option value="medium">关注</option>
          <option value="low">提示</option>
        </select>
        
        <select 
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 flex-1"
          value={filterType || ''}
          onChange={(e) => setFilterType(e.target.value || null)}
        >
          <option value="">全部类型</option>
          <option value="fake_breakout">假突破</option>
          <option value="golden_pit">黄金坑</option>
          <option value="accumulation">吸筹</option>
          <option value="distribution">出货</option>
          <option value="retail_trap">散户接盘</option>
        </select>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
            <p className="text-sm">暂无预警</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id}
              className={newAlertId === alert.id ? 'animate-pulse' : ''}
            >
              <AlertCard 
                alert={alert} 
                onDismiss={handleDismiss}
                onAction={handleAction}
              />
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            假突破: 价格涨+主力流出
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            黄金坑: 价格跌+主力流入
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            吸筹: 横盘+主力流入
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            出货: 滞涨+主力流出
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            散户接盘: 散户买+主力卖
          </span>
        </div>
      </div>

      {/* CSS for golden pulse animation */}
      <style>{`
        @keyframes golden-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1); }
        }
        .golden-pulse {
          animation: golden-pulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
