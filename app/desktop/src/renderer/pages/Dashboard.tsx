const SPHERES = [
  { key: 'dev', label: 'Dev', color: 'bg-blue-500/20 text-blue-400' },
  { key: 'teaching', label: 'Teaching', color: 'bg-green-500/20 text-green-400' },
  { key: 'study', label: 'Study', color: 'bg-purple-500/20 text-purple-400' },
  { key: 'health', label: 'Health', color: 'bg-orange-500/20 text-orange-400' },
  { key: 'finance', label: 'Finance', color: 'bg-yellow-500/20 text-yellow-400' },
] as const;

export function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Mark2 Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {SPHERES.map(({ key, label, color }) => (
          <div
            key={key}
            className={`rounded-xl p-6 ${color} border border-current/10`}
          >
            <h3 className="text-lg font-semibold">{label}</h3>
            <p className="text-sm opacity-60 mt-1">No data yet</p>
          </div>
        ))}
      </div>
    </div>
  );
}
