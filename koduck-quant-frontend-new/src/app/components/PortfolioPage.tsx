import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function PortfolioPage() {
  // Mock data
  const totalValue = 125840.32;
  const totalChange = 5240.18;
  const changePercent = 4.34;
  const isPositive = changePercent > 0;

  const holdings = [
    { symbol: "BTC", name: "Bitcoin", amount: 2.5, value: 87500, change: 3.2, allocation: 69.5 },
    { symbol: "ETH", name: "Ethereum", amount: 15.8, value: 28440, change: 5.8, allocation: 22.6 },
    { symbol: "SOL", name: "Solana", amount: 125, value: 6250, change: -2.1, allocation: 5.0 },
    { symbol: "USDT", name: "Tether", amount: 3650, value: 3650, change: 0, allocation: 2.9 },
  ];

  return (
    <main className="flex-1 flex flex-col bg-white">
      {/* Top Bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="px-8 py-6">
          <h1 className="text-lg font-medium text-gray-900">Portfolio</h1>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-full max-w-7xl mx-auto px-8 py-8 flex flex-col">
          {/* Total Value Section - Centered */}
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">Total Portfolio Value</p>
              <h2 className="text-5xl font-medium text-gray-900 mb-3">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div className="flex items-center justify-center gap-2">
                <div className={`flex items-center gap-1 ${isPositive ? 'text-[#10a37f]' : 'text-red-500'}`}>
                  {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    ${Math.abs(totalChange).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm">
                    ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                  </span>
                </div>
                <span className="text-sm text-gray-500">24h</span>
              </div>
            </div>
          </div>

          {/* Quick Stats - Equal Width Cards */}
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div className="text-center py-8 hover:bg-gray-50 rounded-2xl transition-colors">
              <p className="text-sm text-gray-500 mb-2">Total Assets</p>
              <p className="text-3xl font-medium text-gray-900">{holdings.length}</p>
            </div>
            <div className="text-center py-8 hover:bg-gray-50 rounded-2xl transition-colors">
              <p className="text-sm text-gray-500 mb-2">Best Performer</p>
              <p className="text-3xl font-medium text-[#10a37f]">ETH +5.8%</p>
            </div>
            <div className="text-center py-8 hover:bg-gray-50 rounded-2xl transition-colors">
              <p className="text-sm text-gray-500 mb-2">Worst Performer</p>
              <p className="text-3xl font-medium text-red-500">SOL -2.1%</p>
            </div>
          </div>

          {/* Holdings Table - Flex Grow to Fill Space */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-8 py-5">
              <h3 className="text-lg font-medium text-gray-900">Holdings</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Asset
                    </th>
                    <th className="px-8 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-8 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-8 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      24h Change
                    </th>
                    <th className="px-8 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Allocation
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {holdings.map((holding) => (
                    <tr key={holding.symbol} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#10a37f] rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {holding.symbol.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{holding.symbol}</div>
                            <div className="text-xs text-gray-500">{holding.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right text-sm text-gray-900">
                        {holding.amount.toLocaleString('en-US', { 
                          minimumFractionDigits: holding.symbol === 'USDT' ? 0 : 1,
                          maximumFractionDigits: holding.symbol === 'USDT' ? 0 : 2 
                        })}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        ${holding.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right text-sm">
                        <div className={`flex items-center justify-end gap-1 ${
                          holding.change > 0 ? 'text-[#10a37f]' : holding.change < 0 ? 'text-red-500' : 'text-gray-500'
                        }`}>
                          {holding.change > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : holding.change < 0 ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : null}
                          <span className="font-medium">
                            {holding.change > 0 ? '+' : ''}{holding.change.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#10a37f] rounded-full"
                              style={{ width: `${holding.allocation}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-14 text-right">
                            {holding.allocation.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}