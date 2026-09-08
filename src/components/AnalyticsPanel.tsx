import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { simulatedEvents } from '../data';

export function AnalyticsPanel() {
  // Event type distribution
  const typeDistribution = simulatedEvents.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeData = Object.entries(typeDistribution).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));

  // Verification status distribution
  const statusData = [
    { name: 'Unverified', value: simulatedEvents.filter(e => e.status === 'unverified').length, color: '#6b7280' },
    { name: 'Pending', value: simulatedEvents.filter(e => e.status === 'pending_verify').length, color: '#eab308' },
    { name: 'Verified', value: simulatedEvents.filter(e => e.status === 'verified').length, color: '#3b82f6' },
    { name: 'Actioned', value: simulatedEvents.filter(e => e.status === 'actioned').length, color: '#22c55e' },
  ];

  // Hourly detection simulation (realistic pattern)
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    detections: Math.round(
      (i >= 6 && i <= 22 ? 15 + Math.sin((i - 6) * 0.5) * 12 : 3) +
      (i >= 8 && i <= 10 ? 10 : 0) +
      (i >= 17 && i <= 19 ? 8 : 0)
    ),
    verified: Math.round(
      (i >= 6 && i <= 22 ? 8 + Math.sin((i - 6) * 0.5) * 6 : 1) +
      (i >= 8 && i <= 10 ? 5 : 0)
    ),
  }));

  // Priority distribution
  const priorityData = [
    { name: 'Critical', count: simulatedEvents.filter(e => e.priority === 'critical').length, color: '#ef4444' },
    { name: 'High', count: simulatedEvents.filter(e => e.priority === 'high').length, color: '#f97316' },
    { name: 'Medium', count: simulatedEvents.filter(e => e.priority === 'medium').length, color: '#eab308' },
    { name: 'Low', count: simulatedEvents.filter(e => e.priority === 'low').length, color: '#6b7280' },
  ];

  // Confidence distribution
  const confidenceData = simulatedEvents.flatMap(e => e.observations).map(obs => ({
    confidence: Math.round(obs.confidence * 100),
  }));

  const avgConf = confidenceData.length > 0
    ? Math.round(confidenceData.reduce((s, c) => s + c.confidence, 0) / confidenceData.length)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Analytics & Insights</h2>
        <p className="text-sm text-gray-400 mt-1">
          Fleet-wide observation analytics and verification metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-blue-400">{avgConf}%</div>
          <div className="text-xs text-gray-400 mt-1">Avg Confidence</div>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-green-400">
            {simulatedEvents.filter(e => e.observations.length >= 2).length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Multi-Pass Events</div>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-amber-400">
            {simulatedEvents.reduce((s, e) => s + e.observations.length, 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">Total Observations</div>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-purple-400">
            {(simulatedEvents.filter(e => e.status === 'verified' || e.status === 'actioned').length / simulatedEvents.length * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Verification Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Detection Pattern */}
        <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            <i className="fa-solid fa-chart-line text-blue-400 mr-2"></i>
            24h Detection Pattern
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6b7280' }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line type="monotone" dataKey="detections" stroke="#3b82f6" strokeWidth={2} dot={false} name="Detections" />
              <Line type="monotone" dataKey="verified" stroke="#22c55e" strokeWidth={2} dot={false} name="Verified" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-500 mt-2">Peak detection during morning (8-10) and evening (17-19) rush hours</p>
        </div>

        {/* Event Type Distribution */}
        <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            <i className="fa-solid fa-chart-bar text-cyan-400 mr-2"></i>
            Event Type Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Verification Status */}
        <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            <i className="fa-solid fa-circle-check text-green-400 mr-2"></i>
            Verification Pipeline Status
          </h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {statusData.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: item.color }}></div>
                  <span className="text-xs text-gray-400">{item.name}</span>
                  <span className="text-xs font-bold text-gray-200">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            <i className="fa-solid fa-ranking-star text-amber-400 mr-2"></i>
            Priority Distribution
          </h3>
          <div className="space-y-3">
            {priorityData.map(item => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{item.name}</span>
                  <span className="text-xs font-bold" style={{ color: item.color }}>{item.count}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(item.count / simulatedEvents.length) * 100}%`,
                      background: item.color,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-700/50">
            <p className="text-[10px] text-gray-500">
              Priority = f(severity, confidence, observation_count, recency)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
