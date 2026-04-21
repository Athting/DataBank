import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

const PALETTE = ["#22d3ee", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

export default function PropertyBarChart({ materials }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || materials.length === 0) return;

    chartRef.current?.destroy();

    const labels = [
      "Seebeck (µV/K)",
      "Conductivity (S/m ÷ 1000)",
      "Thermal Cond. (W/m·K)",
      "ZT",
    ];

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: materials.map((m, i) => ({
          label: m.name,
          backgroundColor: `${PALETTE[i % PALETTE.length]}33`,
          borderColor: PALETTE[i % PALETTE.length],
          borderWidth: 2,
          borderRadius: 4,
          data: [
            m.seebeck,
            m.conductivity / 1000,
            m.thermal_conductivity,
            m.zt * 100,
          ],
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#9ca3af", font: { size: 12 } },
          },
          tooltip: {
            backgroundColor: "#111827",
            borderColor: "#374151",
            borderWidth: 1,
            titleColor: "#f9fafb",
            bodyColor: "#9ca3af",
            callbacks: {
              label: (ctx) => {
                const raw = Number(ctx.raw ?? 0);
                const i = ctx.dataIndex;
                const vals = [
                  `${raw.toFixed(0)} µV/K`,
                  `${raw.toFixed(0)}k S/m`,
                  `${raw.toFixed(2)} W/m·K`,
                  `${(raw / 100).toFixed(2)}`,
                ];
                return ` ${ctx.dataset.label}: ${vals[i]}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#6b7280" },
            grid: { color: "#1f2937" },
          },
          y: {
            ticks: { color: "#6b7280" },
            grid: { color: "#1f2937" },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [materials]);

  return (
    <div className="relative h-72">
      <canvas ref={canvasRef} />
    </div>
  );
}
