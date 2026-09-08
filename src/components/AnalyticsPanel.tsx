import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { apiClient, AnalyticsOverview } from '../api/client';

export function AnalyticsPanel() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'offline_fallback'>('database');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadAnalytics() {
      setLoading(true);
      const res = await apiClient.getAnalyticsOverview();
      if (mounted) {
        setOverview(res.overview);
        setDataSource(res.source);
        setLoading(false);
      }
    }
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        <i className="fa-solid fa-circle-notch fa-spin mr-3 text-blue-500 text-xl"></i>
        <span>Loading live municipal database telemetry...</span>
      </div>
    );
  }

  const data = overview!;
  const totalIssues = data.total_issues || 1;

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">Analytics & Insights</h2>
          <p className="text-sm text-gray-400 mt-1">
            Fleet-wide observation analytics and municipal verification metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
            dataSource === 'database'
              ? 'bg-green-900/40 text-green-300 border border-green-700/50'
              : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
          }`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${dataSource === 'database' ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`}></span>
            {dataSource === 'database' ? 'Live Municipal DB Telemetry' : 'Offline Demonstration Mode'}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-blue-400">{data.avg_confidence}%</div>
          <div className="text-xs text-gray-400 mt-1">Avg Confidence</div>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-green-400">
            {data.multi_pass_events}
          </div>
          <div className="text-xs text-gray-400 mt-1">Multi-Pass Events</div>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-amber-400">
            {data.total_observations}
          </div>
          <div className="text-xs text-gray-400 mt-1">Total Observations</div>
        </div>
        <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50">
          <div className="text-2xl font-bold text-purple-400">
            {data.verification_rate}%
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
            <LineChart data={data.hourly_data}>
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
          <p className="text-[10px] text-gray-500 mt-2">Peak detection during transit schedule rush hours across urban corridors</p>
        </div>

        {/* Event Type Distribution */}
        <div className="p-5 rounded-xl bg-gray-800/20 border border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            <i className="fa-solid fa-chart-bar text-cyan-400 mr-2"></i>
            Distress Type Distribution (Database)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.type_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Issues" />
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
                  data={data.status_data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.status_data.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {data.status_data.map(item => (
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
            Explainable Priority Distribution
          </h3>
          <div className="space-y-3">
            {data.priority_data.map(item => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{item.name}</span>
                  <span className="text-xs font-bold" style={{ color: item.color }}>{item.count}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(item.count / totalIssues) * 100}%`,
                      background: item.color,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-700/50">
            <p className="text-[10px] text-gray-500">
              Explainable Priority = f(severity, confidence, fleet_diversity, observation_count, recency)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
