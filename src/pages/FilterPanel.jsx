import { useEffect, useState } from "react";
import { SlidersHorizontal, Search, Filter } from "lucide-react";
import { fetchMaterials } from "../lib/api";
import MaterialCard from "../components/MaterialCard";
import LoadingSpinner from "../components/LoadingSpinner";

export default function FilterPanel() {
  const [allMaterials, setAllMaterials] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [ztMin, setZtMin] = useState("");
  const [ztMax, setZtMax] = useState("");
  const [category, setCategory] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials({ limit: 1000 })
      .then((data) => {
        setAllMaterials(data);
        setFiltered(data);
      })
      .catch(() => {
        setAllMaterials([]);
        setFiltered([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let result = [...allMaterials];

    if (ztMin !== "") result = result.filter((m) => m.zt >= parseFloat(ztMin));
    if (ztMax !== "") result = result.filter((m) => m.zt <= parseFloat(ztMax));
    if (category) result = result.filter((m) => m.category === category);
    if (searchQ) {
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQ.toLowerCase()) ||
          m.category.toLowerCase().includes(searchQ.toLowerCase()),
      );
    }

    setFiltered(result);
  }, [ztMin, ztMax, category, searchQ, allMaterials]);

  const categories = Array.from(
    new Set(allMaterials.map((m) => m.category)),
  ).sort();

  function reset() {
    setZtMin("");
    setZtMax("");
    setCategory("");
    setSearchQ("");
  }

  const hasFilters = ztMin || ztMax || category || searchQ;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Filter Materials</h2>
        <p className="text-gray-400 text-sm">
          Filter and search the materials database
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search name or category..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-gray-500
                text-sm focus:outline-none focus:border-cyan-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Min ZT</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="3"
              value={ztMin}
              onChange={(e) => setZtMin(e.target.value)}
              placeholder="e.g. 1.0"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500
                text-sm focus:outline-none focus:border-cyan-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5">Max ZT</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="3"
              value={ztMax}
              onChange={(e) => setZtMax(e.target.value)}
              placeholder="e.g. 2.5"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500
                text-sm focus:outline-none focus:border-cyan-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm
                focus:outline-none focus:border-cyan-500/60 transition-colors appearance-none"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-500" />
            <span className="text-gray-400 text-sm">
              <span className="text-white font-medium">{filtered.length}</span>{" "}
              of {allMaterials.length} materials
            </span>
          </div>
          {hasFilters && (
            <button
              onClick={reset}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: "All", min: "", max: "" },
          { label: "ZT ≥ 0.5", min: "0.5", max: "" },
          { label: "ZT ≥ 1.0", min: "1.0", max: "" },
          { label: "ZT ≥ 1.5", min: "1.5", max: "" },
          { label: "ZT ≥ 2.0", min: "2.0", max: "" },
        ].map(({ label, min, max }) => (
          <button
            key={label}
            onClick={() => {
              setZtMin(min);
              setZtMax(max);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
              ${
                ztMin === min && ztMax === max
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <SlidersHorizontal size={40} className="mx-auto mb-4 text-gray-700" />
          <p className="text-gray-500 font-medium">
            No materials match your filters
          </p>
          <button
            onClick={reset}
            className="mt-3 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MaterialCard key={m.id} material={m} />
          ))}
        </div>
      )}
    </div>
  );
}
