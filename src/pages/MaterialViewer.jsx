import { useEffect, useState } from "react";
import { Search, ChevronDown, BarChart2, TrendingUp } from "lucide-react";
import { fetchMaterialByName, searchMaterialNames } from "../lib/api";
import MaterialCard from "../components/MaterialCard";
import PropertyBarChart from "../components/PropertyBarChart";
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
  if (typeof val === "number") return val.toFixed(3);
  if (typeof val === "object" && val !== null) return JSON.stringify(val);
  return val ?? "—";
}

export default function MaterialViewer() {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [open, setOpen] = useState(false);

  const measurementRows = buildMeasurementRows(material);
  const keyValuePairs = buildKeyValuePairs(material);
  const dropdownOptions =
    selected && !results.includes(selected) ? [selected, ...results] : results;

  useEffect(() => {
    const q = query.trim();

    if (!open || q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    let canceled = false;
    setSearching(true);

    const timer = setTimeout(() => {
      searchMaterialNames(q, 20)
        .then((data) => {
          if (canceled) return;
          setResults(data ?? []);
          setSearchError("");
          setSearching(false);
        })
        .catch(() => {
          if (canceled) return;
          setResults([]);
          setSearchError("Could not reach API. Start backend server and try again.");
          setSearching(false);
        });
    }, 250);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  async function loadMaterial(name) {
    setSelected(name);
    setQuery(name);
    setOpen(false);
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

  async function loadTypedQuery() {
    const typed = query.trim();
    if (typed.length < 2) return;
    await loadMaterial(typed);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Material Viewer</h2>
        <p className="text-gray-400 text-sm">
          Search and inspect individual thermoelectric materials
        </p>
      </div>

      <div className="relative max-w-md">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setSearchError("");
              if (selected && e.target.value !== selected) {
                setSelected("");
                setMaterial(null);
              }
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                loadTypedQuery();
              }
            }}
            placeholder="Search materials (e.g. SnSe, PbTe...)"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-10 py-3 text-white placeholder-gray-500
              focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
          />
          <ChevronDown
            size={16}
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>

        {open && query.trim().length >= 2 && (
          <ul className="absolute w-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
            {searching ? (
              <li className="px-4 py-2.5 text-sm text-gray-500">Searching…</li>
            ) : results.length > 0 ? (
              results.map((n) => (
                <li key={n}>
                  <button
                    onClick={() => loadMaterial(n)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-800
                      ${selected === n ? "text-cyan-400 bg-cyan-500/5" : "text-gray-300"}`}
                  >
                    {n}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-2.5 text-sm text-gray-500">
                {searchError || "No matching materials"}
              </li>
            )}
          </ul>
        )}

        {query.trim().length >= 2 && (
          <div className="mt-3">
            <label className="block text-xs text-gray-400 mb-1.5">
              Select compound (dropdown)
            </label>
            <select
              value={selected || ""}
              onChange={(e) => {
                const name = e.target.value;
                if (!name) return;
                loadMaterial(name);
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm
                focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
            >
              <option value="" className="bg-gray-900 text-gray-400">
                {searching
                  ? "Searching compounds..."
                  : dropdownOptions.length > 0
                    ? "Choose a compound"
                    : "No compounds found"}
              </option>
              {dropdownOptions.map((name) => (
                <option key={name} value={name} className="bg-gray-900 text-white">
                  {name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadTypedQuery}
              disabled={query.trim().length < 2 || loading}
              className="mt-2 w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300
                hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Get details for "{query.trim() || "compound"}"
            </button>

            {searchError && (
              <p className="mt-2 text-xs text-amber-300">{searchError}</p>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[5]" onClick={() => setOpen(false)} />
      )}

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

      {!loading && !material && selected && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg font-medium">No data found for "{selected}"</p>
        </div>
      )}

      {!loading && material && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <MaterialCard material={material} highlight />
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={16} className="text-cyan-400" />
                  <h3 className="text-white font-medium text-sm">
                    Property Overview
                  </h3>
                </div>
                <PropertyBarChart materials={[material]} />
              </div>

              {material.temperature_data.length > 0 && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <h3 className="text-white font-medium text-sm">
                      ZT vs Temperature
                    </h3>
                  </div>
                  <ZTLineChart materials={[material]} />
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-medium text-sm">
                Compound Details (Dropdown Format)
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                Expand a property to see its value
              </p>
            </div>
            <div className="p-4 border-b border-gray-800 space-y-2">
              {keyValuePairs.map(([prop, val]) => (
                <details
                  key={`dropdown-${prop}`}
                  className="bg-gray-800/60 border border-gray-700 rounded-lg"
                >
                  <summary className="list-none cursor-pointer px-3 py-2.5 text-sm text-cyan-300 flex items-center justify-between">
                    <span>{prop}</span>
                    <span className="text-xs text-gray-500">▼</span>
                  </summary>
                  <div className="px-3 pb-3 text-sm text-white break-all">
                    {formatDisplayValue(val)}
                  </div>
                </details>
              ))}
            </div>

            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-medium text-sm">
                Compound Key-Value Pairs
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                All primary properties shown as property → value pairs
              </p>
            </div>
            <div className="overflow-x-auto border-b border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/60">
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      Property
                    </th>
                    <th className="text-left px-4 py-3 text-cyan-400 font-semibold">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {keyValuePairs.map(([prop, val]) => (
                    <tr
                      key={prop}
                      className="hover:bg-gray-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-300">{prop}</td>
                      <td className="px-4 py-3 text-white tabular-nums">
                        {formatDisplayValue(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-medium text-sm">
                Compound Data Table
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                Query result in tabular format (one row per temperature point)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/60">
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
                <tbody className="divide-y divide-gray-800">
                  {measurementRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No measurement rows available for this compound.
                      </td>
                    </tr>
                  ) : (
                    measurementRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 text-white font-medium">
                          {row.formula}
                        </td>
                        <td className="px-4 py-3 text-gray-300 tabular-nums">
                          {row.temperature_K}
                        </td>
                        <td className="px-4 py-3 text-gray-300 tabular-nums">
                          {row.seebeck === null ? "—" : row.seebeck.toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 tabular-nums">
                          {row.conductivity === null
                            ? "—"
                            : row.conductivity.toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 tabular-nums">
                          {row.thermal_conductivity === null
                            ? "—"
                            : row.thermal_conductivity.toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-gray-300 tabular-nums">
                          {row.zt === null ? "—" : row.zt.toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{row.doi}</td>
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
