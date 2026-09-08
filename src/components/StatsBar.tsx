import { DashboardStats } from '../types';

interface Props {
  stats: DashboardStats;
}

export function StatsBar({ stats }: Props) {
  const items = [
    { label: 'Total Events', value: stats.totalEvents, icon: 'fa-circle-dot', color: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
    { label: 'Verified Hotspots', value: stats.verifiedEvents, icon: 'fa-circle-check', color: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    { label: 'Active Fleet Units', value: stats.activeBuses, icon: 'fa-bus', color: 'text-sky-400', glow: 'shadow-sky-500/10' },
    { label: 'Critical Defects', value: stats.criticalIssues, icon: 'fa-triangle-exclamation', color: 'text-rose-400', glow: 'shadow-rose-500/10' },
    { label: 'Events Today', value: stats.eventsToday, icon: 'fa-calendar-day', color: 'text-amber-400', glow: 'shadow-amber-500/10' },
    { label: 'Avg AI Confidence', value: `${(stats.avgConfidence * 100).toFixed(0)}%`, icon: 'fa-bullseye', color: 'text-cyan-300', glow: 'shadow-cyan-500/10' },
    { label: 'Multi-Pass Rate', value: `${(stats.multiPassRate * 100).toFixed(0)}%`, icon: 'fa-arrows-rotate', color: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
  ];

  return (
    <div className="bg-[#0e1321]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-2.5 flex items-center gap-4 overflow-x-auto shrink-0 scrollbar-none">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#161b2a]/70 border border-slate-800/80 hover:border-cyan-500/30 transition min-w-fit shadow-sm"
        >
          <div className={`w-6 h-6 rounded-md bg-slate-900/80 border border-slate-700/50 flex items-center justify-center ${item.color}`}>
            <i className={`fa-solid ${item.icon} text-[10px]`}></i>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 font-mono">{item.label}</span>
            <span className="text-xs font-bold text-white font-mono tracking-tight">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
