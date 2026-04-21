import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { MongoClient } from "mongodb";

dotenv.config();

const port = Number.parseInt(process.env.BACKEND_PORT ?? "4000", 10);
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "teg_dashboard";
const collectionName = process.env.MONGODB_COLLECTION ?? "materials";
const clientOrigin = process.env.CLIENT_ORIGIN ?? "*";

if (!mongoUri) {
  throw new Error("Missing MONGODB_URI in environment.");
}

const app = express();
app.use(cors({ origin: clientOrigin === "*" ? true : clientOrigin }));
app.use(express.json());

const mongo = new MongoClient(mongoUri);

function mapMaterial(doc, includeTemperatureData = false) {
  const id = String(doc._id);
  const mapped = {
    id,
    name: doc.name ?? "Unknown",
    seebeck: Number(doc.seebeck ?? 0),
    conductivity: Number(doc.conductivity ?? 0),
    thermal_conductivity: Number(doc.thermal_conductivity ?? 0),
    zt: Number(doc.zt ?? 0),
    category: doc.category ?? "Unknown",
    doi: doc.doi ?? null,
    dois: Array.isArray(doc.dois) ? doc.dois : doc.doi ? [doc.doi] : [],
    source_status: doc.source_status ?? "unknown",
    created_at: doc.created_at
      ? new Date(doc.created_at).toISOString()
      : new Date().toISOString(),
  };

  if (!includeTemperatureData) return mapped;

  const points = Array.isArray(doc.temperature_data)
    ? doc.temperature_data
    : [];

  const normalizeName = (name) => {
    if (!name || typeof name !== "string") return null;
    return name
      .replace(/^\s*(p-type|n-type)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  };

  const normalizeRows = (rows, valueKey) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        temperature_K: Number(
          row?.temperature_K ?? row?.temp ?? row?.temperature ?? Number.NaN,
        ),
        value: Number(row?.[valueKey] ?? row?.value ?? Number.NaN),
        unit: row?.unit ?? row?.original_unit ?? null,
      }))
      .filter((row) => Number.isFinite(row.value));
  };

  const measurements = doc.measurements ?? {};

  const normalizedMeasurements = {
    seebeck: normalizeRows(measurements.seebeck, "value_uV_per_K"),
    conductivity: normalizeRows(measurements.conductivity, "value_S_per_m"),
    thermal_conductivity: normalizeRows(
      measurements.thermal_conductivity,
      "value_W_per_mK",
    ),
    power_factor: normalizeRows(measurements.power_factor, "value"),
    zt: normalizeRows(measurements.zt, "value"),
  };

  const allTemps = [
    ...normalizedMeasurements.seebeck,
    ...normalizedMeasurements.conductivity,
    ...normalizedMeasurements.thermal_conductivity,
    ...normalizedMeasurements.power_factor,
    ...normalizedMeasurements.zt,
  ]
    .map((r) => r.temperature_K)
    .filter((t) => Number.isFinite(t));

  const profileTemp = allTemps.includes(300)
    ? 300
    : allTemps.length > 0
      ? [...allTemps].sort((a, b) => a - b)[0]
      : null;

  const getValueAtOrNull = (rows, temp) => {
    if (!Number.isFinite(temp)) return null;
    const exact = rows.find((r) => r.temperature_K === temp);
    return exact ? exact.value : null;
  };

  const extracted = doc?.source_json?.extracted_data ?? {};
  const materialNorm = normalizeName(mapped.name);

  const latticeRow = (extracted?.lattice_parameters?.lattice_data ?? []).find(
    (row) => normalizeName(row?.material) === materialNorm,
  );

  const crystalRow = (extracted?.crystal_structure?.crystal_data ?? []).find(
    (row) => normalizeName(row?.material) === materialNorm,
  );

  const spaceRow = (extracted?.space_group?.space_group_data ?? []).find(
    (row) => normalizeName(row?.material) === materialNorm,
  );

  const tempKeys = new Set();
  for (const p of points) {
    const t = Number(p?.temp ?? Number.NaN);
    if (Number.isFinite(t)) tempKeys.add(t);
  }
  for (const bucket of Object.values(normalizedMeasurements)) {
    for (const row of bucket) {
      if (Number.isFinite(row.temperature_K)) tempKeys.add(row.temperature_K);
    }
  }

  const getValueAtTemp = (rows, temp) => {
    const found = rows.find((row) => row.temperature_K === temp);
    return found ? found.value : null;
  };

  const key_value_by_temperature = [...tempKeys]
    .sort((a, b) => a - b)
    .map((temp) => ({
      temperature_K: temp,
      values: {
        seebeck_uV_per_K: getValueAtTemp(normalizedMeasurements.seebeck, temp),
        conductivity_S_per_m: getValueAtTemp(
          normalizedMeasurements.conductivity,
          temp,
        ),
        thermal_conductivity_W_per_mK: getValueAtTemp(
          normalizedMeasurements.thermal_conductivity,
          temp,
        ),
        power_factor: getValueAtTemp(normalizedMeasurements.power_factor, temp),
        zt: getValueAtTemp(normalizedMeasurements.zt, temp),
      },
    }));

  return {
    ...mapped,
    compound_profile: {
      material_composition: mapped.name,
      seebeck_coefficient:
        getValueAtOrNull(normalizedMeasurements.seebeck, profileTemp) ??
        mapped.seebeck,
      electrical_conductivity:
        getValueAtOrNull(normalizedMeasurements.conductivity, profileTemp) ??
        mapped.conductivity,
      thermal_conductivity:
        getValueAtOrNull(
          normalizedMeasurements.thermal_conductivity,
          profileTemp,
        ) ?? mapped.thermal_conductivity,
      power_factor:
        getValueAtOrNull(normalizedMeasurements.power_factor, profileTemp) ??
        null,
      figure_of_merit_ZT:
        getValueAtOrNull(normalizedMeasurements.zt, profileTemp) ?? mapped.zt,
      temperature: Number.isFinite(profileTemp) ? `${profileTemp} K` : "",
      crystal_structure: crystalRow?.structure ?? "",
      space_group: spaceRow?.space_group ?? "",
      lattice_parameters: latticeRow
        ? {
            material: latticeRow.material ?? mapped.name,
            a: latticeRow.a ?? "",
            b: latticeRow.b ?? "",
            c: latticeRow.c ?? "",
            alpha: latticeRow.alpha ?? "",
            beta: latticeRow.beta ?? "",
            gamma: latticeRow.gamma ?? "",
            system: latticeRow.system ?? "",
          }
        : {},
    },
    key_value: {
      formula: mapped.name,
      category: mapped.category,
      doi: mapped.doi ?? "—",
      seebeck_uV_per_K: mapped.seebeck,
      conductivity_S_per_m: mapped.conductivity,
      thermal_conductivity_W_per_mK: mapped.thermal_conductivity,
      zt_peak: mapped.zt,
    },
    key_value_by_temperature,
    temperature_data: points
      .map((point, idx) => ({
        id: point.id ? String(point.id) : `${id}-${point.temp ?? idx}-${idx}`,
        material_id: point.material_id ? String(point.material_id) : id,
        temp: Number(point.temp ?? 0),
        zt: Number(point.zt ?? 0),
      }))
      .sort((a, b) => a.temp - b.temp),
    measurements: normalizedMeasurements,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/materials", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const minZt = Number.parseFloat(String(req.query.minZt ?? ""));
    const maxZt = Number.parseFloat(String(req.query.maxZt ?? ""));
    const includeTemp = req.query.includeTemp === "true";
    const limitRaw = Number.parseInt(String(req.query.limit ?? "200"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 200;

    const filter = {};

    if (q) {
      filter.name = { $regex: q, $options: "i" };
    }

    if (category) {
      filter.category = category;
    }

    if (Number.isFinite(minZt) || Number.isFinite(maxZt)) {
      filter.zt = {};
      if (Number.isFinite(minZt)) filter.zt.$gte = minZt;
      if (Number.isFinite(maxZt)) filter.zt.$lte = maxZt;
    }

    const sort = { zt: -1, name: 1 };

    const docs = await app.locals.collection
      .find(filter)
      .sort(sort)
      .limit(limit)
      .toArray();

    res.json(docs.map((doc) => mapMaterial(doc, includeTemp)));
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch materials" });
  }
});

app.get("/api/materials/names", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 50;

    const filter = q ? { name: { $regex: q, $options: "i" } } : {};

    const docs = await app.locals.collection
      .find(filter, { projection: { name: 1 } })
      .sort({ name: 1 })
      .limit(limit)
      .toArray();

    res.json(docs.map((d) => d.name).filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch names" });
  }
});

app.get("/api/materials/by-names", async (req, res) => {
  try {
    const namesParam =
      typeof req.query.names === "string" ? req.query.names : "";
    const names = namesParam
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (names.length === 0) {
      return res.json([]);
    }

    const docs = await app.locals.collection
      .find({ name: { $in: names } })
      .toArray();

    const mapped = docs.map((doc) => mapMaterial(doc, true));
    mapped.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));

    return res.json(mapped);
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch materials" });
  }
});

app.get("/api/materials/:name", async (req, res) => {
  try {
    const name = req.params.name;

    const doc = await app.locals.collection.findOne({
      name: {
        $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    if (!doc) {
      return res.status(404).json({ error: "Material not found" });
    }

    return res.json(mapMaterial(doc, true));
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || "Failed to fetch material" });
  }
});

async function start() {
  await mongo.connect();
  const db = mongo.db(dbName);
  app.locals.collection = db.collection(collectionName);

  app.listen(port, () => {
    console.log(`Mongo API running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
