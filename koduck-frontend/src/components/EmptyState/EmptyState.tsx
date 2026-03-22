import React from 'react';

interface EmptyStateProps {
  type: 'search' | 'error' | 'loading' | 'data' | 'network';
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: string[];
}

export function EmptyState({
  type,
  title,
  description,
  action,
  secondaryAction,
  suggestions
}: EmptyStateProps) {
  const configs = {
    search: {
      icon: 'search_off',
      defaultTitle: '未找到匹配的股票',
      defaultDescription: '请尝试其他关键词或股票代码',
      iconColor: 'text-slate-500'
    },
    error: {
      icon: 'error_outline',
      defaultTitle: '加载失败',
      defaultDescription: '无法获取数据，请稍后重试',
      iconColor: 'text-red-500'
    },
    loading: {
      icon: 'hourglass_empty',
      defaultTitle: '加载中...',
      defaultDescription: '正在获取最新数据',
      iconColor: 'text-cyan-400'
    },
    data: {
      icon: 'inbox',
      defaultTitle: '暂无数据',
      defaultDescription: '当前没有可显示的数据',
      iconColor: 'text-slate-500'
    },
    network: {
      icon: 'cloud_off',
      defaultTitle: '网络连接失败',
      defaultDescription: '请检查网络连接后重试',
      iconColor: 'text-amber-500'
    }
  };

  const config = configs[type];
  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {/* Icon */}
      <div className={`mb-4 ${config.iconColor}`}>
        <span className="material-symbols-outlined text-6xl">{config.icon}</span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-slate-200 mb-2">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-slate-400 mb-4 max-w-md">
        {displayDescription}
      </p>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">试试搜索：</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  // Try to find a search input and set its value
                  const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                  if (searchInput) {
                    searchInput.value = suggestion;
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                }}
                className="px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {action.label}
          </button>
        )}
        
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Specialized empty states for common use cases
export function SearchEmptyState({ keyword, onRetry }: { keyword?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      type="search"
      title={keyword ? `未找到 "${keyword}" 相关的股票` : '未找到匹配的股票'}
      description="请尝试其他关键词，如股票名称、代码或拼音首字母"
      suggestions={['茅台', '600519', '银行', '新能源']}
      action={onRetry ? { label: '清除搜索', onClick: onRetry } : undefined}
    />
  );
}

export function ErrorEmptyState({ 
  message, 
  onRetry 
}: { 
  message?: string; 
  onRetry: () => void 
}) {
  return (
    <EmptyState
      type="error"
      title="加载失败"
      description={message || '无法获取数据，请检查网络连接后重试'}
      action={{ label: '重新加载', onClick: onRetry }}
    />
  );
}

export function NetworkErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      type="network"
      title="网络连接失败"
      description="无法连接到服务器，请检查网络设置"
      action={{ label: '重试', onClick: onRetry }}
      secondaryAction={{ label: '查看帮助', onClick: () => window.open('/help', '_blank') }}
    />
  );
}

export function LoadingState({ message }: { message?: string }) {
  return (
    <EmptyState
      type="loading"
      title="加载中..."
      description={message || '正在获取最新市场数据'}
    />
  );
}

export function NoDataState({ 
  message, 
  onRefresh 
}: { 
  message?: string; 
  onRefresh?: () => void 
}) {
  return (
    <EmptyState
      type="data"
      title="暂无数据"
      description={message || '当前没有可显示的数据，可能市场已收盘或数据更新中'}
      action={onRefresh ? { label: '刷新数据', onClick: onRefresh } : undefined}
    />
  );
}

// Skeleton loading component
export function SkeletonLoader({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-slate-800 rounded"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-800 rounded w-3/4"></div>
            <div className="h-3 bg-slate-800 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Table skeleton loader
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex space-x-4 p-4 border-b border-slate-800">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-800 rounded flex-1"></div>
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 p-4 border-b border-slate-800/50">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="h-4 bg-slate-800/50 rounded flex-1"></div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Card skeleton loader
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-slate-700 rounded-lg"></div>
            <div className="w-16 h-8 bg-slate-700 rounded"></div>
          </div>
          <div className="h-6 bg-slate-700 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
}
