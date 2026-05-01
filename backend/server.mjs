import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

dotenv.config();

const port = Number.parseInt(process.env.BACKEND_PORT ?? "4000", 10);
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "teg_dashboard";
const collectionName = process.env.MONGODB_COLLECTION ?? "materials";
const clientOrigin = process.env.CLIENT_ORIGIN ?? "*";
const isProduction = process.env.NODE_ENV === "production";
const fallbackJsonPath =
  process.env.FALLBACK_JSON_PATH ??
  path.resolve(process.cwd(), "JSONS", "_default_data_extracted.json");

if (!mongoUri) {
  console.warn("Missing MONGODB_URI in environment. API will run in fallback mode.");
}

const app = express();

const allowedOrigins = clientOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (clientOrigin === "*" || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (!isProduction && isLocalDevOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  }),
);
app.use(express.json());

const mongo = mongoUri
  ? new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 20000,
    })
  : null;

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/[+-]?\d*\.?\d+/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTemp(value) {
  return parseNumber(value);
}

function conductivityToSm(value, unit) {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  if ((unit ?? "").toLowerCase().includes("s/cm")) return parsed * 100;
  return parsed;
}

function inferCategory(materialName) {
  const n = String(materialName ?? "").toLowerCase();
  if (n.includes("te")) return "Telluride";
  if (n.includes("se")) return "Selenide";
  if (n.includes("p")) return "Phosphide";
  return "Unknown";
}

function pickRepresentativeValue(rows, key) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const withTemp = rows.filter((r) => Number.isFinite(r.temperature_K));
  if (withTemp.length > 0) {
    const nearest300 = [...withTemp].sort(
      (a, b) =>
        Math.abs(a.temperature_K - 300) - Math.abs(b.temperature_K - 300),
    )[0];
    const candidate = nearest300?.[key];
    if (Number.isFinite(candidate)) return candidate;
  }

  const first = rows.find((r) => Number.isFinite(r?.[key]));
  return first ? first[key] : null;
}

function buildDocsFromExtract(extractJson) {
  const extracted = extractJson?.extracted_data ?? {};
  const materials = extracted?.material_composition?.materials ?? [];
  const seebeckRows = extracted?.seebeck_coefficient?.seebeck_data ?? [];
  const ztRows = extracted?.figure_of_merit_ZT?.zt_data ?? [];
  const condRows = extracted?.electrical_conductivity?.conductivity_data ?? [];
  const thermalRows =
    extracted?.thermal_conductivity?.thermal_conductivity_data ?? [];
  const powerRows = extracted?.power_factor?.power_factor_data ?? [];

  const byCompound = new Map();

  const ensureCompound = (name) => {
    const compound = String(name ?? "").trim();
    if (!compound) return null;
    const found = byCompound.get(compound);
    if (found) return found;

    const created = {
      _id: compound,
      name: compound,
      seebeck_points: [],
      conductivity_points: [],
      thermal_conductivity_points: [],
      power_factor_points: [],
      zt_points: [],
      temperature_data: [],
    };

    byCompound.set(compound, created);
    return created;
  };

  for (const name of materials) ensureCompound(name);

  for (const row of seebeckRows) {
    const target = ensureCompound(row?.material);
    if (!target) continue;
    const parsed = parseNumber(row?.value);
    if (parsed === null) continue;
    target.seebeck_points.push({
      temperature_K: parseTemp(row?.temperature),
      value_uV_per_K: parsed,
      unit: row?.unit ?? null,
    });
  }

  for (const row of condRows) {
    const target = ensureCompound(row?.material);
    if (!target) continue;
    const parsed = conductivityToSm(row?.value, row?.unit);
    if (parsed === null) continue;
    target.conductivity_points.push({
      temperature_K: parseTemp(row?.temperature),
      value_S_per_m: parsed,
      original_unit: row?.unit ?? null,
    });
  }

  for (const row of thermalRows) {
    const target = ensureCompound(row?.material);
    if (!target) continue;
    const parsed = parseNumber(row?.value);
    if (parsed === null) continue;
    target.thermal_conductivity_points.push({
      temperature_K: parseTemp(row?.temperature),
      value_W_per_mK: parsed,
      unit: row?.unit ?? null,
    });
  }

  for (const row of powerRows) {
    const target = ensureCompound(row?.material);
    if (!target) continue;
    const parsed = parseNumber(row?.value);
    if (parsed === null) continue;
    target.power_factor_points.push({
      temperature_K: parseTemp(row?.temperature),
      value: parsed,
      unit: row?.unit || null,
    });
  }

  for (const row of ztRows) {
    const target = ensureCompound(row?.material);
    if (!target) continue;
    const parsed = parseNumber(row?.zt_value);
    if (parsed === null) continue;

    const temp = parseTemp(row?.temperature);
    target.zt_points.push({ temperature_K: temp, value: parsed });
    if (Number.isFinite(temp)) target.temperature_data.push({ temp, zt: parsed });
  }

  const docs = [];
  for (const grouped of byCompound.values()) {
    grouped.temperature_data.sort((a, b) => a.temp - b.temp);
    const ztValues = grouped.zt_points
      .map((z) => z.value)
      .filter((z) => Number.isFinite(z));
    const ztPeak = ztValues.length > 0 ? Math.max(...ztValues) : null;

    docs.push({
      _id: grouped._id,
      name: grouped.name,
      doi: extractJson?.doi ?? null,
      source_status: extractJson?.extraction_status ?? "fallback",
      category: inferCategory(grouped.name),
      seebeck: pickRepresentativeValue(grouped.seebeck_points, "value_uV_per_K"),
      conductivity: pickRepresentativeValue(
        grouped.conductivity_points,
        "value_S_per_m",
      ),
      thermal_conductivity: pickRepresentativeValue(
        grouped.thermal_conductivity_points,
        "value_W_per_mK",
      ),
      zt: ztPeak,
      temperature_data: grouped.temperature_data,
      measurements: {
        seebeck: grouped.seebeck_points,
        conductivity: grouped.conductivity_points,
        thermal_conductivity: grouped.thermal_conductivity_points,
        power_factor: grouped.power_factor_points,
        zt: grouped.zt_points,
      },
      created_at: new Date().toISOString(),
      source_json: extractJson,
    });
  }

  return docs;
}

async function loadFallbackMaterials() {
  try {
    const raw = await fs.readFile(fallbackJsonPath, "utf8");
    const json = JSON.parse(raw);
    const docs = buildDocsFromExtract(json);
    return Array.isArray(docs) ? docs : [];
  } catch (error) {
    console.warn(`Failed to load fallback JSON: ${error.message}`);
    return [];
  }
}

function getFallbackMaterials() {
  return Array.isArray(app.locals.fallbackMaterials)
    ? app.locals.fallbackMaterials
    : [];
}

function queryFallbackMaterials({ q, category, minZt, maxZt, limit, skip }) {
  let rows = [...getFallbackMaterials()];

  if (q) {
    const qLower = q.toLowerCase();
    rows = rows.filter((doc) =>
      String(doc.name ?? "").toLowerCase().includes(qLower),
    );
  }

  if (category) rows = rows.filter((doc) => doc.category === category);
  if (Number.isFinite(minZt)) {
    rows = rows.filter((doc) => Number(doc.zt ?? Number.NEGATIVE_INFINITY) >= minZt);
  }
  if (Number.isFinite(maxZt)) {
    rows = rows.filter((doc) => Number(doc.zt ?? Number.POSITIVE_INFINITY) <= maxZt);
  }

  rows.sort(
    (a, b) =>
      Number(b.zt ?? Number.NEGATIVE_INFINITY) -
        Number(a.zt ?? Number.NEGATIVE_INFINITY) ||
      String(a.name ?? "").localeCompare(String(b.name ?? "")),
  );

  return rows.slice(skip, skip + limit);
}

function mapMaterial(doc, includeTemperatureData = false) {
  const id = String(doc._id ?? doc.id ?? doc.name ?? "unknown");
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
    const skipRaw = Number.parseInt(String(req.query.skip ?? "0"), 10);
    const skip = Number.isFinite(skipRaw) ? Math.max(skipRaw, 0) : 0;

    let docs = [];
    if (app.locals.collection) {
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

      docs = await app.locals.collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();
    } else {
      docs = queryFallbackMaterials({ q, category, minZt, maxZt, limit, skip });
    }

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

    if (app.locals.collection) {
      const filter = q ? { name: { $regex: q, $options: "i" } } : {};

      const docs = await app.locals.collection
        .find(filter, { projection: { name: 1 } })
        .sort({ name: 1 })
        .limit(limit)
        .toArray();

      return res.json(docs.map((d) => d.name).filter(Boolean));
    }

    const names = getFallbackMaterials()
      .map((d) => d.name)
      .filter(Boolean)
      .filter((name) => (q ? name.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit);

    return res.json(names);
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

    let docs = [];
    if (app.locals.collection) {
      docs = await app.locals.collection.find({ name: { $in: names } }).toArray();
    } else {
      const wanted = new Set(names);
      docs = getFallbackMaterials().filter((d) => wanted.has(d.name));
    }

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

    let doc = null;
    if (app.locals.collection) {
      doc = await app.locals.collection.findOne({
        name: {
          $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i",
        },
      });
    } else {
      const wanted = name.toLowerCase();
      doc = getFallbackMaterials().find(
        (d) => String(d.name ?? "").toLowerCase() === wanted,
      );
    }

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
  app.locals.collection = null;
  app.locals.fallbackMaterials = [];

  if (mongo) {
    try {
      await mongo.connect();
      const db = mongo.db(dbName);
      app.locals.collection = db.collection(collectionName);
      console.log(`Connected to MongoDB (${dbName}.${collectionName})`);
    } catch (error) {
      console.warn(
        `Mongo unavailable (${error.message}). Using fallback dataset: ${fallbackJsonPath}`,
      );
    }
  }

  if (!app.locals.collection) {
    app.locals.fallbackMaterials = await loadFallbackMaterials();
    console.log(`Fallback materials loaded: ${app.locals.fallbackMaterials.length}`);
  }

  app.listen(port, () => {
    console.log(`API running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
