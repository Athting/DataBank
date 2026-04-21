import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

const PALETTE = ["#22d3ee", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

export default function ZTLineChart({ materials }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || materials.length === 0) return;
    chartRef.current?.destroy();

    const allTemps = Array.from(
      new Set(materials.flatMap((m) => m.temperature_data.map((d) => d.temp))),
    ).sort((a, b) => a - b);

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: allTemps.map((t) => `${t}K`),
        datasets: materials.map((m, i) => {
          const tempMap = new Map(
            m.temperature_data.map((d) => [d.temp, d.zt]),
          );
          return {
            label: m.name,
            data: allTemps.map((t) => tempMap.get(t) ?? null),
            borderColor: PALETTE[i % PALETTE.length],
            backgroundColor: `${PALETTE[i % PALETTE.length]}15`,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: false,
            spanGaps: false,
          };
        }),
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
              label: (ctx) =>
                ` ${ctx.dataset.label}: ZT = ${Number(ctx.raw ?? 0).toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Temperature (K)", color: "#6b7280" },
            ticks: { color: "#6b7280", maxTicksLimit: 8 },
            grid: { color: "#1f2937" },
          },
          y: {
            title: {
              display: true,
              text: "Figure of Merit (ZT)",
              color: "#6b7280",
            },
            ticks: { color: "#6b7280" },
            grid: { color: "#1f2937" },
            min: 0,
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
