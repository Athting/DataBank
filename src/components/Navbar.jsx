import {
  LayoutDashboard,
  FlaskConical,
  GitCompare,
  Filter,
  Zap,
} from "lucide-react";

const navItems = [
  {
    page: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={16} />,
  },
  {
    page: "viewer",
    label: "Material Viewer",
    icon: <FlaskConical size={16} />,
  },
  { page: "compare", label: "Compare", icon: <GitCompare size={16} /> },
  { page: "filter", label: "Filter", icon: <Filter size={16} /> },
];

export default function Navbar({ currentPage, onNavigate, onOpenDataset }) {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            type="button"
            onClick={() => (onOpenDataset ? onOpenDataset() : onNavigate("filter"))}
            className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-gray-800/70 transition-colors"
            title="Open TEG dataset"
          >
            <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <Zap size={20} className="text-cyan-400" />
            </div>
            <div>
              <span className="text-white font-semibold text-sm tracking-tight">
                TEG Analysis
              </span>
              <span className="hidden sm:block text-gray-500 text-xs">
                Material Dashboard
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {navItems.map(({ page, label, icon }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${
                    currentPage === page
                      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
