import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, Plus, Search, GitCompare, X } from "lucide-react";
import { fetchMaterials, fetchMaterialsByNames } from "../lib/api";
import LoadingSpinner from "../components/LoadingSpinner";
import PropertyBarChart from "../components/PropertyBarChart";
import ZTLineChart from "../components/ZTLineChart";

const COLUMN_OPTIONS = [
  { key: "name", label: "Formula" },
  { key: "zt", label: "Energy above hull [eV/atom]" },
  { key: "seebeck", label: "Heat of formation [eV/atom]" },
  { key: "thermal_conductivity", label: "Band gap (PBE) [eV]" },
  { key: "source_status", label: "Magnetic" },
  { key: "category", label: "Layer group (not Space group)" },
  { key: "conductivity", label: "Conductivity (S/m)" },
  { key: "doi", label: "DOI" },
];

const ELEMENT_SYMBOLS = [
  "H",
  "He",
  "Li",
  "Be",
  "B",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "Si",
  "P",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Sc",
  "Ti",
  "V",
  "Cr",
  "Mn",
  "Fe",
  "Co",
  "Ni",
  "Cu",
  "Zn",
  "Ga",
  "Ge",
  "As",
  "Se",
  "Br",
  "Kr",
  "Rb",
  "Sr",
  "Y",
  "Zr",
  "Nb",
  "Mo",
  "Tc",
  "Ru",
  "Rh",
  "Pd",
  "Ag",
  "Cd",
  "In",
  "Sn",
  "Sb",
  "Te",
  "I",
  "Xe",
  "Cs",
  "Ba",
  "La",
  "Ce",
  "Pr",
  "Nd",
  "Pm",
  "Sm",
  "Eu",
  "Gd",
  "Tb",
  "Dy",
  "Ho",
  "Er",
  "Tm",
  "Yb",
  "Lu",
  "Hf",
  "Ta",
  "W",
  "Re",
  "Os",
  "Ir",
  "Pt",
  "Au",
  "Hg",
  "Tl",
  "Pb",
  "Bi",
  "Po",
  "At",
  "Rn",
  "Fr",
  "Ra",
  "Ac",
  "Th",
  "Pa",
  "U",
  "Np",
  "Pu",
  "Am",
  "Cm",
  "Bk",
  "Cf",
  "Es",
  "Fm",
  "Md",
  "No",
  "Lr",
  "Rf",
  "Db",
  "Sg",
  "Bh",
  "Hs",
  "Mt",
  "Ds",
  "Rg",
  "Cn",
  "Nh",
  "Fl",
  "Mc",
  "Lv",
  "Ts",
  "Og",
];

function normalizeFormula(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSpeciesOnly(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z]/g, "");
}

function formatCell(value) {
  if (typeof value === "number") return value.toFixed(3);
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function parseElementsFromFormula(value) {
  if (!value || typeof value !== "string") return [];
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  const matches = cleaned.match(/[A-Z][a-z]?/g) ?? [];
  return [...new Set(matches)];
}

export default function FilterPanel({ onSelectMaterial }) {
  const [allMaterials, setAllMaterials] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [visibleRows, setVisibleRows] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [stoichiometryInput, setStoichiometryInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedTegGroup, setSelectedTegGroup] = useState("");
  const [minZt, setMinZt] = useState("0.0");
  const [maxZt, setMaxZt] = useState("3.0");
  const [ztDomain, setZtDomain] = useState({ min: 0, max: 3 });
  const [elementMode, setElementMode] = useState("include");
  const [includeElements, setIncludeElements] = useState([]);
  const [excludeElements, setExcludeElements] = useState([]);
  const [magnetic, setMagnetic] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [selectedColumns, setSelectedColumns] = useState([
    "name",
    "zt",
    "seebeck",
    "thermal_conductivity",
    "source_status",
    "category",
  ]);
  const [columnToAdd, setColumnToAdd] = useState("");
  const [compareNames, setCompareNames] = useState([]);
  const [compareMaterials, setCompareMaterials] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let canceled = false;

    async function loadAllMaterials() {
      const pageSize = 500;
      const merged = [];
      let skip = 0;
      const maxPages = 200;

      for (let page = 0; page < maxPages; page += 1) {
        const chunk = await fetchMaterials({ limit: pageSize, skip });
        const rows = Array.isArray(chunk) ? chunk : [];
        merged.push(...rows);

        if (rows.length < pageSize) break;
        skip += pageSize;
      }

      return merged;
    }

    loadAllMaterials()
      .then((data) => {
        if (canceled) return;
        const sorted = [...(data ?? [])].sort((a, b) => b.zt - a.zt);
        setAllMaterials(sorted);
        const ztVals = sorted
          .map((m) => Number(m.zt ?? Number.NaN))
          .filter((v) => Number.isFinite(v));
        if (ztVals.length > 0) {
          const min = Math.min(...ztVals);
          const max = Math.max(...ztVals);
          setZtDomain({ min, max: min === max ? min + 1 : max });
          setMinZt(min.toFixed(3));
          setMaxZt(max.toFixed(3));
        }
        setLoadError("");
      })
      .catch((error) => {
        if (canceled) return;
        setAllMaterials([]);
        setLoadError(error?.message || "Failed to load materials from API");
      })
      .finally(() => {
        if (canceled) return;
        setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const q = searchQ.trim();
    const formulaQ = normalizeFormula(q);
    const speciesQ = normalizeSpeciesOnly(q);
    const stoichQ = normalizeFormula(stoichiometryInput.trim());
    const stoichSpeciesQ = normalizeSpeciesOnly(stoichiometryInput.trim());
    const min = Number.parseFloat(minZt);
    const max = Number.parseFloat(maxZt);

    let result = [...allMaterials];

    if (q) {
      result = result.filter((m) => {
        const formula = normalizeFormula(m.name);
        const speciesOnly = normalizeSpeciesOnly(m.name);
        return (
          formula.includes(formulaQ) ||
          speciesOnly.includes(speciesQ) ||
          m.category.toLowerCase().includes(q.toLowerCase()) ||
          String(m.doi ?? "")
            .toLowerCase()
            .includes(q.toLowerCase())
        );
      });
    }

    if (stoichQ || stoichSpeciesQ) {
      result = result.filter((m) => {
        const formula = normalizeFormula(m.name);
        const speciesOnly = normalizeSpeciesOnly(m.name);
        return (
          (stoichQ && formula.includes(stoichQ)) ||
          (stoichSpeciesQ && speciesOnly.includes(stoichSpeciesQ))
        );
      });
    }

    if (selectedTegGroup) {
      result = result.filter((m) => m.category === selectedTegGroup);
    }

    if (Number.isFinite(min)) {
      result = result.filter((m) => Number(m.zt ?? 0) >= min);
    }
    if (Number.isFinite(max)) {
      result = result.filter((m) => Number(m.zt ?? 0) <= max);
    }

    if (magnetic === "yes") {
      result = result.filter((m) => Number(m.zt ?? 0) > 0);
    } else if (magnetic === "no") {
      result = result.filter((m) => Number(m.zt ?? 0) === 0);
    }

    if (includeElements.length > 0 || excludeElements.length > 0) {
      result = result.filter((m) => {
        const elements = parseElementsFromFormula(m.name);
        const hasIncluded = includeElements.every((el) =>
          elements.includes(el),
        );
        const hasExcluded = excludeElements.some((el) => elements.includes(el));
        return hasIncluded && !hasExcluded;
      });
    }

    setFiltered(result);
    setPage(1);
  }, [
    allMaterials,
    searchQ,
    stoichiometryInput,
    selectedTegGroup,
    minZt,
    maxZt,
    magnetic,
    includeElements,
    excludeElements,
  ]);

  useEffect(() => {
    if (compareNames.length === 0) {
      setCompareMaterials([]);
      return;
    }

    let canceled = false;
    setCompareLoading(true);

    fetchMaterialsByNames(compareNames)
      .then((rows) => {
        if (canceled) return;
        const ordered = [...(rows ?? [])].sort(
          (a, b) => compareNames.indexOf(a.name) - compareNames.indexOf(b.name),
        );
        setCompareMaterials(ordered);
      })
      .catch(() => {
        if (canceled) return;
        setCompareMaterials([]);
      })
      .finally(() => {
        if (canceled) return;
        setCompareLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [compareNames]);

  useEffect(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    setVisibleRows(filtered.slice(start, end));
  }, [filtered, page, rowsPerPage]);

  const selectedColumnDefs = useMemo(
    () =>
      selectedColumns
        .map((key) => COLUMN_OPTIONS.find((c) => c.key === key))
        .filter(Boolean),
    [selectedColumns],
  );

  const availableColumnDefs = useMemo(
    () => COLUMN_OPTIONS.filter((c) => !selectedColumns.includes(c.key)),
    [selectedColumns],
  );

  const tegGroups = useMemo(
    () => Array.from(new Set(allMaterials.map((m) => m.category))).sort(),
    [allMaterials],
  );

  const totalRows = filtered.length;
  const startRow = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const endRow = totalRows === 0 ? 0 : Math.min(page * rowsPerPage, totalRows);
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  function runSearch() {
    setSearchQ(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setStoichiometryInput("");
    setSearchQ("");
    setSelectedTegGroup("");
    setMinZt(ztDomain.min.toFixed(3));
    setMaxZt(ztDomain.max.toFixed(3));
    setMagnetic("");
    setIncludeElements([]);
    setExcludeElements([]);
    setPage(1);
  }

  function addColumn() {
    if (!columnToAdd) return;
    if (selectedColumns.includes(columnToAdd)) return;
    setSelectedColumns((prev) => [...prev, columnToAdd]);
    setColumnToAdd("");
  }

  function removeColumn(key) {
    if (selectedColumns.length <= 1) return;
    setSelectedColumns((prev) => prev.filter((k) => k !== key));
  }

  function toggleElement(symbol) {
    if (elementMode === "include") {
      setIncludeElements((prev) =>
        prev.includes(symbol)
          ? prev.filter((s) => s !== symbol)
          : [...prev, symbol],
      );
      setExcludeElements((prev) => prev.filter((s) => s !== symbol));
      return;
    }

    setExcludeElements((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol],
    );
    setIncludeElements((prev) => prev.filter((s) => s !== symbol));
  }

  function toggleCompare(name) {
    setCompareNames((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 3) return prev;
      return [...prev, name];
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-6 space-y-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-72 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              placeholder="Example: 'MoS2'"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-gray-400"
            />
          </div>
          <button
            type="button"
            onClick={runSearch}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg text-white font-medium"
          >
            Search
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 rounded-lg text-white font-medium"
          >
            Clear
          </button>
        </div>

        <div className="grid md:grid-cols-[220px_minmax(240px,1fr)] gap-x-7 gap-y-3 items-center text-sm">
          <label className="text-gray-200">TEG group:</label>
          <select
            value={selectedTegGroup}
            onChange={(e) => setSelectedTegGroup(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white"
          >
            <option value="">-</option>
            {tegGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>

          <label className="text-gray-200">Stoichiometry:</label>
          <input
            value={stoichiometryInput}
            onChange={(e) => setStoichiometryInput(e.target.value)}
            placeholder="A, AB2, ABC, ..."
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-400"
          />

          <label className="text-gray-200">Magnetic:</label>
          <select
            value={magnetic}
            onChange={(e) => setMagnetic(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white"
          >
            <option value="">-</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>

          <label className="text-gray-200">ZT range:</label>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="range"
                min={ztDomain.min}
                max={ztDomain.max}
                step="0.001"
                value={Number.parseFloat(minZt) || ztDomain.min}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value);
                  const upper = Number.parseFloat(maxZt);
                  setMinZt(Math.min(next, upper).toFixed(3));
                }}
                className="w-full accent-cyan-500"
              />
              <input
                type="range"
                min={ztDomain.min}
                max={ztDomain.max}
                step="0.001"
                value={Number.parseFloat(maxZt) || ztDomain.max}
                onChange={(e) => {
                  const next = Number.parseFloat(e.target.value);
                  const lower = Number.parseFloat(minZt);
                  setMaxZt(Math.max(next, lower).toFixed(3));
                }}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <input
                value={minZt}
                onChange={(e) => setMinZt(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white"
              />
              <span className="text-gray-400">-</span>
              <input
                value={maxZt}
                onChange={(e) => setMaxZt(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-700/70 bg-gray-900/70 p-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <h3 className="text-sm font-medium text-cyan-300">
              Advanced Element Picker (Periodic Table)
            </h3>
            <div className="inline-flex rounded-lg border border-gray-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setElementMode("include")}
                className={`px-3 py-1.5 ${elementMode === "include" ? "bg-emerald-500/20 text-emerald-300" : "bg-gray-800 text-gray-400"}`}
              >
                Include
              </button>
              <button
                type="button"
                onClick={() => setElementMode("exclude")}
                className={`px-3 py-1.5 ${elementMode === "exclude" ? "bg-rose-500/20 text-rose-300" : "bg-gray-800 text-gray-400"}`}
              >
                Exclude
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Click elements to filter materials containing selected elements (and
            excluding blocked elements).
          </p>

          <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-18 gap-1.5">
            {ELEMENT_SYMBOLS.map((symbol) => {
              const included = includeElements.includes(symbol);
              const excluded = excludeElements.includes(symbol);
              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => toggleElement(symbol)}
                  className={`h-8 rounded border text-xs transition-colors
                    ${included ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200" : ""}
                    ${excluded ? "border-rose-400/60 bg-rose-500/20 text-rose-200" : ""}
                    ${!included && !excluded ? "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500" : ""}`}
                  title={symbol}
                >
                  {symbol}
                </button>
              );
            })}
          </div>

          {(includeElements.length > 0 || excludeElements.length > 0) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {includeElements.map((el) => (
                <span
                  key={`in-${el}`}
                  className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-300"
                >
                  + {el}
                </span>
              ))}
              {excludeElements.map((el) => (
                <span
                  key={`ex-${el}`}
                  className="rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-300"
                >
                  − {el}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Could not load dataset from backend. Reason:{" "}
          <span className="font-mono">{loadError}</span>
        </div>
      ) : (
        <div className="text-sm text-emerald-400">
          Found {totalRows} rows out of {allMaterials.length}, showing rows{" "}
          {startRow}-{endRow}
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1.5">
              Add column
            </label>
            <select
              value={columnToAdd}
              onChange={(e) => setColumnToAdd(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white min-w-52
                focus:outline-none focus:border-cyan-500/60 transition-colors"
            >
              <option value="">Select column...</option>
              {availableColumnDefs.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addColumn}
            disabled={!columnToAdd}
            className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed
              text-gray-950 font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {selectedColumnDefs.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeColumn(c.key)}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-700 bg-gray-800 text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
              title="Click to remove column"
            >
              {c.label} ×
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!loading && !loadError && filtered.length === 0 && (
        <div className="text-center py-16">
          <SlidersHorizontal size={40} className="mx-auto mb-4 text-gray-700" />
          <p className="text-gray-500 font-medium">No materials available</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/70">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <GitCompare size={14} className="text-cyan-400" />
              Compare selection:
              {compareNames.length === 0 ? (
                <span className="text-gray-500">None</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {compareNames.map((name) => (
                    <span
                      key={`cmp-chip-${name}`}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-200"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => toggleCompare(name)}
                        className="text-cyan-400 hover:text-rose-300"
                        title="Remove from compare"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCompareNames([])}
              disabled={compareNames.length === 0}
              className="px-3 py-1.5 rounded-md border border-gray-700 text-xs text-gray-300 disabled:opacity-50"
            >
              Clear compare
            </button>
          </div>

          <div className="max-h-[72vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/70">
                  {selectedColumnDefs.map((c) => (
                    <th
                      key={c.key}
                      className="sticky top-0 z-10 text-left px-4 py-3 text-cyan-400 font-semibold whitespace-nowrap bg-gray-900"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="sticky top-0 z-10 text-left px-4 py-3 text-cyan-400 font-semibold whitespace-nowrap bg-gray-900">
                    Compare
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {visibleRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-800/40 transition-colors"
                  >
                    {selectedColumnDefs.map((c) => (
                      <td
                        key={`${row.id}-${c.key}`}
                        className="px-4 py-3 text-gray-200 whitespace-nowrap"
                      >
                        {c.key === "name" &&
                        typeof onSelectMaterial === "function" ? (
                          <button
                            type="button"
                            onClick={() => onSelectMaterial(row.name)}
                            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                            title="Open compound details"
                          >
                            {formatCell(row[c.key])}
                          </button>
                        ) : (
                          formatCell(row[c.key])
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-200 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleCompare(row.name)}
                        disabled={
                          compareNames.length >= 3 &&
                          !compareNames.includes(row.name)
                        }
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors
                          ${compareNames.includes(row.name) ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200" : "border-gray-700 text-gray-300 hover:border-gray-600"}
                          disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {compareNames.includes(row.name)
                          ? "Selected"
                          : "Add to compare"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-800 bg-gray-900/70">
            <div className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Rows:</label>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-md border border-gray-700 text-sm text-gray-300 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-md border border-gray-700 text-sm text-gray-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {(compareNames.length > 0 || compareLoading) && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
            <GitCompare size={16} /> Interactive Comparison
          </h3>

          {compareLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : compareMaterials.length < 2 ? (
            <div className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-700 px-4 py-6 text-center">
              Select at least 2 materials (up to 3) to render side-by-side
              charts.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
                <p className="text-xs text-gray-400 mb-3">
                  Grouped property chart
                </p>
                <PropertyBarChart materials={compareMaterials.slice(0, 3)} />
              </div>

              {compareMaterials.some((m) => m.temperature_data?.length > 0) && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4">
                  <p className="text-xs text-gray-400 mb-3">
                    ZT trend comparison
                  </p>
                  <ZTLineChart materials={compareMaterials.slice(0, 3)} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
