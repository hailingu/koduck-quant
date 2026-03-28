import './CapitalRiver.css';

export interface FundFlowData {
  layer: string;
  sector: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  color?: string;
}

interface Props {
  data?: FundFlowData[];
  loading?: boolean;
}

const FEATURE_BUBBLES = [
  { label: 'TECH', value: '+12%', tone: 'cyan', className: 'cr-bubble-tech' },
  { label: 'FINANCE', value: '+28%', tone: 'cyan', className: 'cr-bubble-finance' },
  { label: 'ENERGY', value: '-4%', tone: 'rose', className: 'cr-bubble-energy' },
];

const PARTICLES = [
  { className: 'cr-particle-1' },
  { className: 'cr-particle-2' },
  { className: 'cr-particle-3' },
  { className: 'cr-particle-4' },
  { className: 'cr-particle-5' },
];

export function CapitalRiver({ data: _data = [], loading: _loading = false }: Props) {
  return (
    <div className="glass-panel p-6 rounded-xl h-full flex flex-col justify-between overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-headline font-extrabold text-2xl tracking-tighter text-on-surface">Capital River</h2>
          <p className="text-xs text-on-surface-variant font-label">Real-time Fund Flow Dynamics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-surface-container px-3 py-1 rounded text-[10px] font-label text-primary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_4px_rgba(0,242,255,1)]" />
            INFLOW: $4.2B
          </div>
          <div className="bg-surface-container px-3 py-1 rounded text-[10px] font-label text-secondary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_4px_rgba(255,179,181,1)]" />
            OUTFLOW: $2.1B
          </div>
        </div>
      </div>

      <div className="capital-river-scene mt-2 flex-1 min-h-[300px]">
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 1200 560"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cr-river-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(25,224,255,0.10)" />
              <stop offset="50%" stopColor="rgba(25,224,255,0.28)" />
              <stop offset="100%" stopColor="rgba(25,224,255,0.08)" />
            </linearGradient>
          </defs>
          <path
            className="capital-river-wave"
            d="M0,360 C180,250 350,450 540,370 C690,300 820,430 960,380 C1060,346 1130,326 1200,360 L1200,560 L0,560 Z"
            fill="url(#cr-river-gradient)"
          />
        </svg>

        {PARTICLES.map((particle) => (
          <span key={particle.className} className={`cr-particle ${particle.className}`} />
        ))}

        <div className="absolute w-full h-full flex items-center justify-around z-10 px-12">
          {FEATURE_BUBBLES.map((bubble) => (
            <div
              key={bubble.label}
              className={`cr-bubble ${bubble.className} ${
                bubble.tone === 'cyan' ? 'cr-bubble-cyan' : 'cr-bubble-rose'
              }`}
            >
              <div className={`text-[10px] font-label ${bubble.tone === 'cyan' ? 'text-primary-container' : 'text-secondary'}`}>
                {bubble.label}
              </div>
              <div className={`mt-0.5 font-bold text-on-surface ${bubble.label === 'FINANCE' ? 'text-sm' : 'text-xs'}`}>
                {bubble.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-cyan-500/40 pt-3">
        <div className="cr-flow-lines cr-flow-lines-cyan" />
        <div className="mt-3 cr-flow-lines cr-flow-lines-rose" />
        <div className="mt-2 flex items-center justify-between text-[8px] tracking-widest text-on-surface-variant/40 uppercase font-label">
          <span>Max Gainers (+10%)</span>
          <span>Sector Breadth Distribution</span>
          <span>Max Losers (-10%)</span>
        </div>
      </div>
    </div>
  );
}
