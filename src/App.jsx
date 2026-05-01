import { useEffect, useState } from "react";
import MaterialViewer from "./pages/MaterialViewer";
import FilterPanel from "./pages/FilterPanel";
import { isApiConfigured } from "./lib/api";

const MATERIAL_ROUTE_PREFIX = "/material/";

function getMaterialFromPath(pathname) {
  if (!pathname?.startsWith(MATERIAL_ROUTE_PREFIX)) return "";

  const raw = pathname.slice(MATERIAL_ROUTE_PREFIX.length).trim();
  if (!raw) return "";

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function App() {
  const [selectedMaterialName, setSelectedMaterialName] = useState(() =>
    getMaterialFromPath(window.location.pathname),
  );

  useEffect(() => {
    const onPopState = () => {
      setSelectedMaterialName(getMaterialFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function handleSelectMaterial(name) {
    if (!name || typeof name !== "string") return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const nextPath = `${MATERIAL_ROUTE_PREFIX}${encodeURIComponent(trimmed)}`;
    window.history.pushState({}, "", nextPath);
    setSelectedMaterialName(trimmed);
  }

  function handleBackToTable() {
    window.history.pushState({}, "", "/");
    setSelectedMaterialName("");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            TEG One-Page Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Search field and TEG dropdown first, then dataset rows/columns
            below.
          </p>
        </div>

        {!isApiConfigured && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            API URL is not set. Using default{" "}
            <code className="font-mono">http://localhost:4000/api</code>. Set{" "}
            <code className="font-mono">VITE_API_URL</code> in{" "}
            <code className="font-mono">.env</code> to change it.
          </div>
        )}

        <div className="space-y-10">
          {selectedMaterialName ? (
            <section className="space-y-4">
              <button
                type="button"
                onClick={handleBackToTable}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:border-gray-600 hover:text-white"
              >
                ← Back to compounds table
              </button>
              <MaterialViewer initialMaterialName={selectedMaterialName} />
            </section>
          ) : (
            <section>
              <FilterPanel onSelectMaterial={handleSelectMaterial} />
            </section>
          )}
        </div>
      </main>
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-gray-600 text-sm">
              TEG Material Analysis Dashboard
            </p>
            <p className="text-gray-700 text-xs">
              Thermoelectric Generator Research Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
