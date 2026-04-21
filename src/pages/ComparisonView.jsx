import { useEffect, useState } from "react";
import { X, Plus, BarChart2, TrendingUp, GitCompare } from "lucide-react";
import { fetchMaterialsByNames, searchMaterialNames } from "../lib/api";
import MaterialCard from "../components/MaterialCard";
import PropertyBarChart from "../components/PropertyBarChart";
import ZTLineChart from "../components/ZTLineChart";
import LoadingSpinner from "../components/LoadingSpinner";

const MAX_COMPARE = 3;

export default function ComparisonView() {
  const [names, setNames] = useState([]);
  const [selected, setSelected] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    searchMaterialNames("", 500)
      .then((data) => {
        setNames(data ?? []);
      })
      .catch(() => {
        setNames([]);
      });
  }, []);

  async function addMaterial(name) {
    if (selected.includes(name) || selected.length >= MAX_COMPARE) return;
    setSelected((prev) => [...prev, name]);
    setLoading(true);

    try {
      const fetched = await fetchMaterialsByNames([name]);
      if (fetched.length > 0) {
        setMaterials((prev) => [...prev, fetched[0]]);
      }
    } finally {
      setLoading(false);
    }
  }

  function removeMaterial(name) {
    setSelected((prev) => prev.filter((n) => n !== name));
    setMaterials((prev) => prev.filter((m) => m.name !== name));
  }

  const available = names.filter((n) => !selected.includes(n));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Comparison View</h2>
        <p className="text-gray-400 text-sm">
          Compare up to {MAX_COMPARE} materials side-by-side
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex flex-wrap items-center gap-3">
          {selected.map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-1.5"
            >
              <span className="text-cyan-300 text-sm font-medium">{name}</span>
              <button
                onClick={() => removeMaterial(name)}
                className="text-cyan-500 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {selected.length < MAX_COMPARE && (
            <div className="relative group">
              <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-400 hover:text-gray-200 text-sm transition-colors">
                <Plus size={14} />
                Add Material
              </button>
              <div
                className="absolute top-full mt-1 left-0 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-10
                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200"
              >
                <div className="max-h-60 overflow-y-auto py-1">
                  {available.length === 0 ? (
                    <p className="px-4 py-2 text-gray-500 text-sm">
                      No more materials
                    </p>
                  ) : (
                    available.map((n) => (
                      <button
                        key={n}
                        onClick={() => addMaterial(n)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                      >
                        {n}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {selected.length === 0 && (
            <span className="text-gray-600 text-sm italic">
              Click "Add Material" to get started
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {!loading && materials.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <GitCompare size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No materials selected</p>
          <p className="text-sm mt-1">
            Add up to {MAX_COMPARE} materials to compare them
          </p>
        </div>
      )}

      {materials.length > 0 && (
        <div className="space-y-6">
          <div
            className={`grid gap-4 ${materials.length === 1 ? "max-w-sm" : materials.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
          >
            {materials.map((m) => (
              <MaterialCard key={m.id} material={m} />
            ))}
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} className="text-cyan-400" />
              <h3 className="text-white font-medium text-sm">
                Property Comparison
              </h3>
            </div>
            <PropertyBarChart materials={materials} />
          </div>

          {materials.some((m) => m.temperature_data.length > 0) && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-emerald-400" />
                <h3 className="text-white font-medium text-sm">
                  ZT vs Temperature
                </h3>
              </div>
              <ZTLineChart materials={materials} />
            </div>
          )}

          {materials.length >= 2 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-white font-medium text-sm">
                  Properties Table
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-5 py-3 text-gray-400 font-medium">
                        Property
                      </th>
                      {materials.map((m) => (
                        <th
                          key={m.id}
                          className="text-right px-5 py-3 text-gray-300 font-medium"
                        >
                          {m.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {[
                      {
                        label: "Seebeck (µV/K)",
                        key: "seebeck",
                        fmt: (v) => v.toFixed(0),
                      },
                      {
                        label: "Conductivity (kS/m)",
                        key: "conductivity",
                        fmt: (v) => (v / 1000).toFixed(0),
                      },
                      {
                        label: "Thermal Cond. (W/m·K)",
                        key: "thermal_conductivity",
                        fmt: (v) => v.toFixed(2),
                      },
                      {
                        label: "ZT (peak)",
                        key: "zt",
                        fmt: (v) => v.toFixed(2),
                      },
                    ].map(({ label, key, fmt }) => {
                      const vals = materials.map((m) => m[key]);
                      const max = Math.max(...vals);
                      return (
                        <tr
                          key={key}
                          className="hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-5 py-3 text-gray-400">{label}</td>
                          {materials.map((m) => {
                            const v = m[key];
                            const isBest = v === max;
                            return (
                              <td
                                key={m.id}
                                className={`px-5 py-3 text-right font-mono tabular-nums ${isBest ? "text-emerald-400 font-semibold" : "text-gray-300"}`}
                              >
                                {fmt(v)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
