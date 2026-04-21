import { Activity, Zap, Thermometer, TrendingUp, Tag } from "lucide-react";

function ZTBadge({ zt }) {
  const color =
    zt >= 2.0
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : zt >= 1.0
        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
        : "bg-amber-500/15 text-amber-400 border-amber-500/30";
  const label = zt >= 2.0 ? "Excellent" : zt >= 1.0 ? "Good" : "Moderate";
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}
    >
      {label}
    </span>
  );
}

const props = [
  {
    key: "seebeck",
    label: "Seebeck Coefficient",
    unit: "µV/K",
    icon: <Activity size={14} />,
    color: "text-cyan-400",
  },
  {
    key: "conductivity",
    label: "Electrical Conductivity",
    unit: "S/m",
    icon: <Zap size={14} />,
    color: "text-yellow-400",
  },
  {
    key: "thermal_conductivity",
    label: "Thermal Conductivity",
    unit: "W/m·K",
    icon: <Thermometer size={14} />,
    color: "text-orange-400",
  },
  {
    key: "zt",
    label: "Figure of Merit (ZT)",
    unit: "",
    icon: <TrendingUp size={14} />,
    color: "text-emerald-400",
  },
];

export default function MaterialCard({
  material,
  highlight = false,
  compact = false,
}) {
  return (
    <div
      className={`rounded-xl border bg-gray-900 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
        ${highlight ? "border-cyan-500/40 shadow-cyan-500/10 shadow-lg" : "border-gray-800 hover:border-gray-700"}`}
    >
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-white font-semibold text-lg leading-tight">
              {material.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Tag size={12} className="text-gray-500" />
              <span className="text-gray-500 text-xs">{material.category}</span>
            </div>
          </div>
          <ZTBadge zt={material.zt} />
        </div>
      </div>

      <div
        className={`p-5 ${compact ? "grid grid-cols-2 gap-3" : "space-y-3"}`}
      >
        {props.map(({ key, label, unit, icon, color }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={color}>{icon}</span>
              <span className="text-gray-400 text-sm">
                {compact ? label.split(" ")[0] : label}
              </span>
            </div>
            <span className="text-white font-mono text-sm font-medium tabular-nums">
              {key === "conductivity"
                ? `${(material[key] / 1000).toFixed(0)}k`
                : material[key].toFixed(key === "zt" ? 2 : 0)}
              {unit && (
                <span className="text-gray-500 text-xs ml-1">{unit}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-gray-500 text-xs">ZT Rating</span>
          <span className="text-gray-400 text-xs font-mono">
            {material.zt.toFixed(2)} / 3.0
          </span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-cyan-500 to-emerald-400"
            style={{ width: `${Math.min((material.zt / 3.0) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
