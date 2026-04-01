import { useWebSocketStore } from '@/stores/websocket'

interface WebSocketStatusProps {
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function WebSocketStatus({ 
  showLabel = true, 
  size = 'sm' 
}: WebSocketStatusProps) {
  const { connectionState } = useWebSocketStore()

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  const statusConfig = {
    connected: {
      dotColor: 'bg-green-500',
      dotAnimation: 'animate-pulse',
      label: '已连接',
      textColor: 'text-green-400',
    },
    connecting: {
      dotColor: 'bg-yellow-500',
      dotAnimation: 'animate-spin',
      label: '连接中',
      textColor: 'text-yellow-400',
    },
    reconnecting: {
      dotColor: 'bg-yellow-500',
      dotAnimation: 'animate-pulse',
      label: '重连中',
      textColor: 'text-yellow-400',
    },
    disconnected: {
      dotColor: 'bg-red-500',
      dotAnimation: '',
      label: '已断开',
      textColor: 'text-red-400',
    },
  }

  const config = statusConfig[connectionState]

  return (
    <div className="flex items-center gap-1.5">
      <span 
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          ${config.dotColor} 
          ${config.dotAnimation}
        `} 
      />
      {showLabel && (
        <span className={`text-xs font-mono-data ${config.textColor}`}>
          {config.label}
        </span>
      )}
    </div>
  )
}

/**
 * Compact version for header/toolbar use
 */
export function WebSocketStatusDot({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <WebSocketStatus showLabel={false} size={size} />
}

/**
 * Full status with reconnect button
 */
export function WebSocketStatusWithAction() {
  const { connectionState, connect } = useWebSocketStore()
  const isDisconnected = connectionState === 'disconnected'

  return (
    <div className="flex items-center gap-2">
      <WebSocketStatus />
      {isDisconnected && (
        <button
          onClick={connect}
          className="text-xs px-2 py-0.5 rounded bg-fluid-surface-higher text-fluid-text hover:bg-fluid-primary/20 hover:text-fluid-primary transition-colors"
        >
          重连
        </button>
      )}
    </div>
  )
}
