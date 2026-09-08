import { DashboardStats } from '../types';

interface Props {
  stats: DashboardStats;
}

export function StatsBar({ stats }: Props) {
  const items = [
    { label: 'Total Events', value: stats.totalEvents, icon: 'fa-circle-dot', color: 'text-blue-400' },
    { label: 'Verified', value: stats.verifiedEvents, icon: 'fa-circle-check', color: 'text-green-400' },
    { label: 'Active Buses', value: stats.activeBuses, icon: 'fa-bus', color: 'text-cyan-400' },
    { label: 'Critical', value: stats.criticalIssues, icon: 'fa-triangle-exclamation', color: 'text-red-400' },
    { label: 'Events Today', value: stats.eventsToday, icon: 'fa-calendar-day', color: 'text-amber-400' },
    { label: 'Avg Confidence', value: `${(stats.avgConfidence * 100).toFixed(0)}%`, icon: 'fa-bullseye', color: 'text-purple-400' },
    { label: 'Multi-Pass Rate', value: `${(stats.multiPassRate * 100).toFixed(0)}%`, icon: 'fa-arrows-rotate', color: 'text-emerald-400' },
  ];

  return (
    <div className="bg-gray-900/30 border-b border-gray-800 px-6 py-2 flex items-center gap-6 overflow-x-auto shrink-0">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 min-w-fit">
          <i className={`fa-solid ${item.icon} text-[10px] ${item.color}`}></i>
          <span className="text-[11px] text-gray-400">{item.label}:</span>
          <span className="text-sm font-bold text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
