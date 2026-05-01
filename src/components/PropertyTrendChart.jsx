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
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

function toSeries(rows, key) {
  return rows
    .map((row) => ({
      temperature: Number(row?.temperature_K ?? Number.NaN),
      value: Number(row?.[key] ?? Number.NaN),
    }))
    .filter((p) => Number.isFinite(p.temperature) && Number.isFinite(p.value))
    .sort((a, b) => a.temperature - b.temperature);
}

export default function PropertyTrendChart({ rows }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !Array.isArray(rows) || rows.length === 0) return;

    const seebeck = toSeries(rows, "seebeck");
    const conductivity = toSeries(rows, "conductivity");
    const thermal = toSeries(rows, "thermal_conductivity");
    const zt = toSeries(rows, "zt");

    const allTemps = Array.from(
      new Set(
        [...seebeck, ...conductivity, ...thermal, ...zt].map(
          (p) => p.temperature,
        ),
      ),
    ).sort((a, b) => a - b);

    if (allTemps.length < 2) return;

    const toDataset = (label, color, unitSuffix, series, mapper = (v) => v) => {
      const map = new Map(series.map((p) => [p.temperature, mapper(p.value)]));
      return {
        label,
        borderColor: color,
        backgroundColor: `${color}22`,
        data: allTemps.map((t) => map.get(t) ?? null),
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
        tension: 0.3,
        spanGaps: false,
        unitSuffix,
      };
    };

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: allTemps.map((t) => `${t} K`),
        datasets: [
          toDataset("Seebeck", "#22d3ee", "µV/K", seebeck),
          toDataset("Conductivity", "#60a5fa", "S/m", conductivity),
          toDataset("Thermal Cond.", "#a78bfa", "W/m·K", thermal),
          toDataset("ZT", "#34d399", "", zt),
        ],
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
                const raw = Number(ctx.raw ?? Number.NaN);
                if (!Number.isFinite(raw)) return ` ${ctx.dataset.label}: —`;
                const unit = ctx.dataset.unitSuffix
                  ? ` ${ctx.dataset.unitSuffix}`
                  : "";
                return ` ${ctx.dataset.label}: ${raw.toPrecision(4)}${unit}`;
              },
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
            ticks: { color: "#6b7280" },
            grid: { color: "#1f2937" },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [rows]);

  return (
    <div className="relative h-72">
      <canvas ref={canvasRef} />
    </div>
  );
}
