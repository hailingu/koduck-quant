import { useEffect, useMemo, useState } from 'react';
import { getCapitalRiver, type CapitalRiverResponse } from '@/api/dashboard';
import SentimentRadar from '@/components/SentimentRadar';
import { CapitalRiver, type FundFlowData } from './components/CapitalRiver';

function HistoryPlaybackCard() {
  return (
    <div className="glass-panel rounded-xl border border-outline-variant/10 p-6 h-full flex flex-col">
      <div className="flex-1 flex items-start">
        <h3 className="font-headline font-bold text-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-on-surface-variant">history</span>
          History Playback
        </h3>
      </div>

      <div className="flex-1 flex items-center">
        <div className="bg-surface-container-lowest rounded-lg p-3 w-full">
          <div className="flex items-center justify-between text-on-surface-variant">
            <button className="material-symbols-outlined text-2xl hover:text-primary transition-colors">fast_rewind</button>
            <button className="material-symbols-outlined text-primary text-4xl">play_circle</button>
            <button className="material-symbols-outlined text-2xl hover:text-primary transition-colors">fast_forward</button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        <div className="flex items-center justify-between text-[10px] font-label text-on-surface-variant">
          <span>T-12h</span>
          <span>Live</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-surface-container-highest relative overflow-visible">
          <div className="h-full w-1/2 rounded-full bg-primary-container" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary-container shadow-[0_0_12px_rgba(0,242,255,0.35)]" />
        </div>
      </div>
    </div>
  );
}

function WarningSystemCard() {
  return (
    <div className="glass-panel rounded-xl border border-outline-variant/10 p-5 h-full flex flex-col">
      <h3 className="text-sm font-headline font-bold text-on-surface">Warning System</h3>

      <div className="mt-4 rounded-lg border border-amber-400/35 bg-[#0a1019] p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-amber-300 text-xl">warning</span>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">GOLDEN PIT DETECTED</div>
          <p className="mt-1 text-[10px] text-on-surface-variant leading-tight">
            Price drop on rising net inflow.
            <br />
            Accumulation phase.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-rose-500/30 bg-[#0a1019] p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-rose-300 text-xl">trending_down</span>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-rose-300 font-bold">FALSE BREAKOUT</div>
          <p className="mt-1 text-[10px] text-on-surface-variant leading-tight">
            Price peak on cooling momentum.
            <br />
            High reversal risk.
          </p>
        </div>
      </div>
    </div>
  );
}

function NorthboundFlowCard() {
  const bars = [24, 32, 48, 86, 62, 47, 25];

  return (
    <div className="glass-panel rounded-xl border border-outline-variant/10 p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-headline font-bold text-on-surface">Northbound Flow</h3>
        <span className="text-cyan-200 text-[10px] font-label font-bold">+¥2.4B</span>
      </div>

      <div className="mt-4 flex items-end gap-2 h-20">
        {bars.map((h, idx) => (
          <div
            key={`${idx}-${h}`}
            className={`flex-1 rounded-t-sm ${idx === 3 ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.35)]' : 'bg-slate-500/55'}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[8px] text-on-surface-variant/50 tracking-widest uppercase font-label">
        <span>OPEN</span>
        <span>MID-DAY</span>
        <span>CLOSE</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [capitalRiver, setCapitalRiver] = useState<CapitalRiverResponse | null>(null);
  const [capitalRiverLoading, setCapitalRiverLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCapitalRiver = async () => {
      try {
        setCapitalRiverLoading(true);
        const data = await getCapitalRiver('AShare', 'TODAY', 3, 10);
        if (!cancelled) {
          setCapitalRiver(data);
        }
      } catch (error) {
        if (!cancelled) {
          setCapitalRiver(null);
        }
        console.warn('Failed to fetch capital river data:', error);
      } finally {
        if (!cancelled) {
          setCapitalRiverLoading(false);
        }
      }
    };

    fetchCapitalRiver();
    return () => {
      cancelled = true;
    };
  }, []);

  const capitalRiverData: FundFlowData[] = useMemo(() => {
    if (!capitalRiver?.tracks) return [];

    const mapItems = (items: { sectorName: string; sectorType: string; mainForceNet: number; changePct?: number | null }[]) =>
      items.map((item) => ({
        layer: item.sectorType,
        sector: item.sectorName,
        inflow: Math.max(item.mainForceNet ?? 0, 0),
        outflow: Math.max(-(item.mainForceNet ?? 0), 0),
        netFlow: item.mainForceNet ?? 0,
        changePct: item.changePct ?? null,
      }));

    return [
      ...mapItems(capitalRiver.tracks.industry || []),
      ...mapItems(capitalRiver.tracks.concept || []),
      ...mapItems(capitalRiver.tracks.region || []),
    ];
  }, [capitalRiver]);

  return (
    <div className="h-full px-4 pt-2 pb-2 flex flex-col gap-3 overflow-hidden">
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="col-span-12 xl:col-span-3 min-h-0 flex flex-col gap-4">
          <div className="flex-[1.18] min-h-0 [&>*]:h-full">
            <SentimentRadar />
          </div>
          <div className="flex-[0.82] min-h-0">
            <HistoryPlaybackCard />
          </div>
        </div>

        <div className="col-span-12 xl:col-span-6 min-h-0 [&>*]:h-full">
          <CapitalRiver
            data={capitalRiverData}
            loading={capitalRiverLoading}
            inflow={capitalRiver?.inflow ?? null}
            outflow={capitalRiver?.outflow ?? null}
          />
        </div>

        <div className="col-span-12 xl:col-span-3 min-h-0 flex flex-col gap-4">
          <div className="flex-[1.1] min-h-0">
            <div className="glass-panel rounded-xl border border-outline-variant/10 p-6 h-full flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-headline font-bold text-on-surface whitespace-nowrap">Big Order Alert</h3>
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-100 text-[10px] font-label">
                  LIVE
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3 p-2 rounded hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-cyan-200 text-sm">rocket_launch</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-on-surface text-[10px] leading-none font-label font-bold">NVDA.US</span>
                      <span className="text-cyan-300 text-[10px] leading-none font-label font-bold whitespace-nowrap">$2.4M BUY</span>
                    </div>
                    <div className="mt-1 text-on-surface-variant/60 text-[9px] leading-none">14:23:45 • BLOCK ORDER</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-rose-300 text-sm">trending_down</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-on-surface text-[10px] leading-none font-label font-bold">TSLA.US</span>
                      <span className="text-rose-300 text-[10px] leading-none font-label font-bold whitespace-nowrap">$1.8M SELL</span>
                    </div>
                    <div className="mt-1 text-on-surface-variant/60 text-[9px] leading-none">14:23:12 • DARK POOL</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-surface-container-high transition-colors">
                  <span className="material-symbols-outlined text-cyan-200 text-sm">rocket_launch</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-on-surface text-[10px] leading-none font-label font-bold">AAPL.US</span>
                      <span className="text-cyan-300 text-[10px] leading-none font-label font-bold whitespace-nowrap">$5.1M BUY</span>
                    </div>
                    <div className="mt-1 text-on-surface-variant/60 text-[9px] leading-none">14:22:58 • ICEBERG</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-[1.05] min-h-0">
            <WarningSystemCard />
          </div>
          <div className="flex-[0.9] min-h-0">
            <NorthboundFlowCard />
          </div>
        </div>
      </div>
    </div>
  );
}
