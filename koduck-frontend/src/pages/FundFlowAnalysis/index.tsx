import MoneyFlowRiver from '@/components/MoneyFlowRiver'
import FundGameMatrix from '@/components/FundGameMatrix'
import FundDivergenceAlert from '@/components/FundDivergenceAlert'
import SentimentRadar from '@/components/SentimentRadar'
import SectorNetworkGraph from '@/components/SectorNetworkGraph'

export default function FundFlowAnalysis() {
  return (
    <div className="space-y-8 pb-8">
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-[#E1E2EB]"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            资金流向 <span className="text-[#00F2FF]">分析中心</span>
          </h1>
          <p className="text-[#849495] font-body mt-2">
            全方位监控市场资金流向，识别主力动向与板块轮动
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1.5 text-xs rounded bg-[#00F2FF]/20 text-[#00F2FF]">
            实时数据
          </span>
          <span className="px-3 py-1.5 text-xs rounded bg-[#272A31] text-[#849495]">
            5大核心模块
          </span>
        </div>
      </div>

      {/* 资金河流图 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <MoneyFlowRiver width={900} height={380} />
      </section>

      {/* 板块资金博弈矩阵 */}
      <FundGameMatrix />

      {/* 资金背离预警系统 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <FundDivergenceAlert />
      </section>

      {/* 六维市场情绪雷达 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <SentimentRadar />
      </section>

      {/* 板块关联网络图谱 */}
      <section className="bg-[#10131A] p-6 rounded-xl border border-[#272A31]">
        <SectorNetworkGraph />
      </section>
    </div>
  )
}
