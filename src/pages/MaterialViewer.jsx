import { useEffect, useState } from "react";
import { Search, BarChart2, TrendingUp } from "lucide-react";
import { fetchMaterialByName } from "../lib/api";
import MaterialCard from "../components/MaterialCard";
import PropertyBarChart from "../components/PropertyBarChart";
import PropertyTrendChart from "../components/PropertyTrendChart";
import ZTLineChart from "../components/ZTLineChart";
import LoadingSpinner from "../components/LoadingSpinner";

function buildMeasurementRows(material) {
  if (!material) return [];

  const measurements = material.measurements ?? {};
  const maps = {
    seebeck: new Map(),
    conductivity: new Map(),
    thermal: new Map(),
    zt: new Map(),
  };

  const fillMap = (rows, target, fallbackKey) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const temp = Number(
        row?.temperature_K ?? row?.temp ?? row?.temperature ?? Number.NaN,
      );
      const value = Number(row?.value ?? row?.[fallbackKey] ?? Number.NaN);
      if (!Number.isFinite(value)) continue;

      const key = Number.isFinite(temp) ? String(temp) : "N/A";
      if (!target.has(key)) {
        target.set(key, value);
      }
    }
  };

  fillMap(measurements.seebeck, maps.seebeck, "value_uV_per_K");
  fillMap(measurements.conductivity, maps.conductivity, "value_S_per_m");
  fillMap(measurements.thermal_conductivity, maps.thermal, "value_W_per_mK");
  fillMap(measurements.zt, maps.zt, "value");

  if (maps.zt.size === 0 && Array.isArray(material.temperature_data)) {
    for (const point of material.temperature_data) {
      const temp = Number(point?.temp ?? Number.NaN);
      const zt = Number(point?.zt ?? Number.NaN);
      const key = Number.isFinite(temp) ? String(temp) : "N/A";
      if (Number.isFinite(zt) && !maps.zt.has(key)) maps.zt.set(key, zt);
    }
  }

  const keys = new Set([
    ...maps.seebeck.keys(),
    ...maps.conductivity.keys(),
    ...maps.thermal.keys(),
    ...maps.zt.keys(),
  ]);

  return [...keys]
    .sort((a, b) => {
      if (a === "N/A") return 1;
      if (b === "N/A") return -1;
      return Number(a) - Number(b);
    })
    .map((tempKey, idx) => ({
      id: `${material.id}-${tempKey}-${idx}`,
      formula: material.name,
      temperature_K: tempKey,
      seebeck: maps.seebeck.has(tempKey) ? maps.seebeck.get(tempKey) : null,
      conductivity: maps.conductivity.has(tempKey)
        ? maps.conductivity.get(tempKey)
        : null,
      thermal_conductivity: maps.thermal.has(tempKey)
        ? maps.thermal.get(tempKey)
        : null,
      zt: maps.zt.has(tempKey) ? maps.zt.get(tempKey) : null,
      doi: material.doi ?? "—",
    }));
}

function buildKeyValuePairs(material) {
  if (!material) return [];

  const kv = material.compound_profile ?? {
    material_composition: material.name ?? "Unknown",
    seebeck_coefficient: material.seebeck ?? null,
    electrical_conductivity: material.conductivity ?? null,
    thermal_conductivity: material.thermal_conductivity ?? null,
    power_factor: null,
    figure_of_merit_ZT: material.zt ?? null,
    temperature: "",
    crystal_structure: "",
    space_group: "",
    lattice_parameters: {},
  };

  return [
    ["material_composition", kv.material_composition],
    ["seebeck_coefficient", kv.seebeck_coefficient],
    ["electrical_conductivity", kv.electrical_conductivity],
    ["thermal_conductivity", kv.thermal_conductivity],
    ["power_factor", kv.power_factor],
    ["figure_of_merit_ZT", kv.figure_of_merit_ZT],
    ["temperature", kv.temperature],
    ["crystal_structure", kv.crystal_structure || ""],
    ["space_group", kv.space_group || ""],
    ["lattice_parameters", kv.lattice_parameters ?? {}],
  ];
}

function formatDisplayValue(val) {
  if (typeof val === "number") return formatScientificNumber(val);
  if (typeof val === "object" && val !== null) return JSON.stringify(val);
  return val ?? "—";
}

function formatScientificNumber(value, digits = 3) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  if (num === 0) return "0.000";

  const abs = Math.abs(num);
  if (abs < 1e-3 || abs >= 1e4) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = num / 10 ** exp;
    return `${mantissa.toFixed(digits)} × 10^${exp}`;
  }

  return num.toFixed(digits);
}

function formatPropertyLabel(prop) {
  return String(prop ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function MaterialViewer({ initialMaterialName = "" }) {
  const [selected, setSelected] = useState("");
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(false);

  const measurementRows = buildMeasurementRows(material);
  const keyValuePairs = buildKeyValuePairs(material);
  const numericTempCount = measurementRows.filter((row) =>
    Number.isFinite(Number(row.temperature_K)),
  ).length;
  const hasMultiTempTrends = numericTempCount >= 2;

  async function loadMaterial(name) {
    setSelected(name);
    setLoading(true);
    setMaterial(null);

    try {
      const mat = await fetchMaterialByName(name);
      setMaterial(mat ?? null);
    } catch {
      setMaterial(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const candidate = initialMaterialName?.trim();
    if (!candidate) return;
    if (candidate === selected) return;
    loadMaterial(candidate);
  }, [initialMaterialName]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200 bg-white/90 p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">
          Material Viewer
        </h2>
        <p className="text-slate-700 text-sm">
          Search and inspect individual thermoelectric materials
        </p>
        {selected && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs text-cyan-700">
            <span className="text-cyan-700">Active compound:</span>
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 font-semibold text-slate-900 break-all">
              {selected}
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!loading && !material && !selected && (
        <div className="text-center py-16 text-gray-600">
          <Search size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">
            Select a material to view its properties
          </p>
          <p className="text-sm mt-1">
            Use the search box above to find materials
          </p>
        </div>
      )}

      {!loading && material && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-sky-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                ZT Peak
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                {formatScientificNumber(material.zt ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Seebeck
              </p>
              <p className="mt-1 text-lg font-semibold text-cyan-300">
                {formatScientificNumber(material.seebeck ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Conductivity
              </p>
              <p className="mt-1 text-lg font-semibold text-sky-300">
                {formatScientificNumber(material.conductivity ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Thermal Cond.
              </p>
              <p className="mt-1 text-lg font-semibold text-violet-300">
                {formatScientificNumber(material.thermal_conductivity ?? 0)}
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <MaterialCard material={material} highlight />
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border border-sky-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={16} className="text-cyan-400" />
                  <h3 className="text-slate-800 font-medium text-sm">
                    {hasMultiTempTrends
                      ? "Property Trends vs Temperature"
                      : "Property Overview"}
                  </h3>
                </div>

                {hasMultiTempTrends ? (
                  <PropertyTrendChart rows={measurementRows} />
                ) : (
                  <>
                    <PropertyBarChart materials={[material]} />
                    <p className="mt-3 text-xs text-slate-500">
                      Limited temperature points detected; showing static
                      property snapshot.
                    </p>
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl border border-sky-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <h3 className="text-slate-800 font-medium text-sm">
                    ZT vs Temperature
                  </h3>
                </div>

                {material.temperature_data.length > 0 ? (
                  <ZTLineChart materials={[material]} />
                ) : (
                  <div className="rounded-lg border border-dashed border-sky-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    No temperature-dependent ZT series available for this
                    material.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-sky-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-sky-200">
              <h3 className="text-slate-800 font-medium text-sm">
                Compound Details (Dropdown Format)
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                Expand a property to see its value
              </p>
            </div>
            <div className="p-4 border-b border-sky-200 space-y-2">
              {keyValuePairs.map(([prop, val]) => (
                <details
                  key={`dropdown-${prop}`}
                  className="bg-slate-50 border border-sky-200 rounded-lg transition-colors hover:border-sky-300"
                >
                  <summary className="list-none cursor-pointer px-3 py-2.5 text-sm text-cyan-700 flex items-center justify-between">
                    <span>{formatPropertyLabel(prop)}</span>
                    <span className="text-xs text-slate-500">▼</span>
                  </summary>
                  <div className="px-3 pb-3 text-sm text-slate-800 break-all">
                    {formatDisplayValue(val)}
                  </div>
                </details>
              ))}
            </div>

            <div className="px-5 py-4 border-b border-sky-200">
              <h3 className="text-slate-800 font-medium text-sm">
                Compound Data Table
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                Query result in tabular format (one row per temperature point)
              </p>
            </div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-sky-200 bg-slate-100">
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      Formula
                    </th>
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      Temperature (K)
                    </th>
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      Seebeck (µV/K)
                    </th>
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      Conductivity (S/m)
                    </th>
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      Thermal Cond. (W/m·K)
                    </th>
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      ZT
                    </th>
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      DOI
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {measurementRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No measurement rows available for this compound.
                      </td>
                    </tr>
                  ) : (
                    measurementRows.map((row) => (
                      <tr
                        key={row.id}
                        className="odd:bg-white even:bg-slate-50 hover:bg-cyan-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-900 font-medium">
                          {row.formula}
                        </td>
                        <td className="px-4 py-3 text-slate-700 tabular-nums">
                          {row.temperature_K}
                        </td>
                        <td className="px-4 py-3 text-slate-700 tabular-nums">
                          {row.seebeck === null
                            ? "—"
                            : formatScientificNumber(row.seebeck)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 tabular-nums">
                          {row.conductivity === null
                            ? "—"
                            : formatScientificNumber(row.conductivity)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 tabular-nums">
                          {row.thermal_conductivity === null
                            ? "—"
                            : formatScientificNumber(row.thermal_conductivity)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 tabular-nums">
                          {row.zt === null
                            ? "—"
                            : formatScientificNumber(row.zt)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.doi}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
