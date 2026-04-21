import { useState } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import MaterialViewer from "./pages/MaterialViewer";
import ComparisonView from "./pages/ComparisonView";
import FilterPanel from "./pages/FilterPanel";
import { isApiConfigured } from "./lib/api";

export default function App() {
  const [page, setPage] = useState("dashboard");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar currentPage={page} onNavigate={setPage} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isApiConfigured && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            API URL is not set. Using default{" "}
            <code className="font-mono">http://localhost:4000/api</code>. Set{" "}
            <code className="font-mono">VITE_API_URL</code> in{" "}
            <code className="font-mono">.env</code> to change it.
          </div>
        )}
        {page === "dashboard" && <Dashboard onNavigate={(p) => setPage(p)} />}
        {page === "viewer" && <MaterialViewer />}
        {page === "compare" && <ComparisonView />}
        {page === "filter" && <FilterPanel />}
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
