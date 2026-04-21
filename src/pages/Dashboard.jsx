import { useEffect, useState } from "react";
import {
  TrendingUp,
  Layers,
  Award,
  ChevronRight,
  Activity,
} from "lucide-react";
import { fetchMaterials } from "../lib/api";
import MaterialCard from "../components/MaterialCard";
import LoadingSpinner from "../components/LoadingSpinner";

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div
      className={`bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{label}</span>
        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials({ limit: 500 })
      .then((data) => {
        setMaterials(data);
      })
      .catch(() => {
        setMaterials([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const topZT = materials[0]?.zt ?? 0;
  const avgZT = materials.length
    ? (materials.reduce((s, m) => s + m.zt, 0) / materials.length).toFixed(2)
    : "—";
  const categories = new Set(materials.map((m) => m.category)).size;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden bg-gray-900 rounded-2xl border border-gray-800 p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 mb-4">
            <Activity size={12} className="text-cyan-400" />
            <span className="text-cyan-400 text-xs font-medium">
              Live Database
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            TEG Material Analysis
          </h1>
          <p className="text-gray-400 max-w-xl">
            A comprehensive database of thermoelectric generator materials with
            properties, performance metrics, and temperature-dependent ZT data.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => onNavigate("viewer")}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Explore Materials <ChevronRight size={16} />
            </button>
            <button
              onClick={() => onNavigate("compare")}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium px-4 py-2 rounded-lg transition-colors text-sm border border-gray-700"
            >
              Compare Side-by-Side
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Layers size={16} className="text-cyan-400" />}
              label="Total Materials"
              value={String(materials.length)}
              sub="In database"
              accent="bg-cyan-500/10"
            />
            <StatCard
              icon={<TrendingUp size={16} className="text-emerald-400" />}
              label="Highest ZT"
              value={topZT.toFixed(2)}
              sub={materials[0]?.name}
              accent="bg-emerald-500/10"
            />
            <StatCard
              icon={<Activity size={16} className="text-yellow-400" />}
              label="Average ZT"
              value={avgZT}
              sub="Across all materials"
              accent="bg-yellow-500/10"
            />
            <StatCard
              icon={<Award size={16} className="text-orange-400" />}
              label="Categories"
              value={String(categories)}
              sub="Material families"
              accent="bg-orange-500/10"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">
                Top Performing Materials
              </h2>
              <button
                onClick={() => onNavigate("filter")}
                className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {materials.slice(0, 6).map((m, i) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  highlight={i === 0}
                  compact
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
