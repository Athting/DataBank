import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "teg_dashboard";
const collectionName = process.env.MONGODB_COLLECTION ?? "materials";
const MIN_PROPERTY_COMPLETENESS = 0.25;
const MAX_ZERO_RATIO = 0.5;

if (!mongoUri) {
  throw new Error("Missing MONGODB_URI in .env");
}

function parseArgs(argv) {
  const args = {
    dir: path.resolve(process.cwd(), "data", "json"),
  };

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--dir" && argv[i + 1]) {
      args.dir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  const normalized = text
    .replace(/×/g, "x")
    .replace(/\s+/g, "")
    .replace(/,/g, "");
  const sciMatch = normalized.match(/^([+-]?\d*\.?\d+)[xX]\^?([+-]?\d+)$/);
  if (sciMatch) {
    const base = Number.parseFloat(sciMatch[1]);
    const exp = Number.parseInt(sciMatch[2], 10);
    if (Number.isFinite(base) && Number.isFinite(exp)) return base * 10 ** exp;
  }

  const match = normalized.match(/[+-]?\d*\.?\d+/);
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
  const n = materialName.toLowerCase();
  if (n.includes("te")) return "Telluride";
  if (n.includes("se")) return "Selenide";
  if (n.includes("p")) return "Phosphide";
  return "Unknown";
}

function normalizeCompoundName(value) {
  if (!value || typeof value !== "string") return null;
  return value
    .replace(/^\s*(p-type|n-type)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
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

  const first = rows.find((r) => Number.isFinite(r[key]));
  return first ? first[key] : null;
}

function upsertMeasurement(bucket, key, row, mapValue) {
  const material = normalizeCompoundName(row?.material);
  if (!material) return;

  const value = mapValue(row);
  if (value === null || value === undefined) return;

  const arr = bucket.get(material) ?? [];
  arr.push(value);
  bucket.set(material, arr);
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
    const compound = normalizeCompoundName(name);
    if (!compound) return null;
    const found = byCompound.get(compound);
    if (found) return found;

    const created = {
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
    target.zt_points.push({
      temperature_K: temp,
      value: parsed,
    });

    if (Number.isFinite(temp)) {
      target.temperature_data.push({ temp, zt: parsed });
    }
  }

  const docs = [];
  for (const grouped of byCompound.values()) {
    grouped.temperature_data.sort((a, b) => a.temp - b.temp);

    const ztValues = grouped.zt_points
      .map((z) => z.value)
      .filter((z) => Number.isFinite(z));

    const ztPeak = ztValues.length > 0 ? Math.max(...ztValues) : null;

    docs.push({
      name: grouped.name,
      doi: extractJson?.doi ?? null,
      source_status: extractJson?.extraction_status ?? "unknown",
      category: inferCategory(grouped.name),
      seebeck: pickRepresentativeValue(
        grouped.seebeck_points,
        "value_uV_per_K",
      ),
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

function mergeByTempValue(
  existingRows,
  incomingRows,
  valueKey,
  tempKey = "temperature_K",
) {
  const merged = new Map();

  for (const row of [...(existingRows ?? []), ...(incomingRows ?? [])]) {
    const temp = Number.isFinite(row?.[tempKey]) ? row[tempKey] : null;
    const value = row?.[valueKey];
    if (!Number.isFinite(value)) continue;
    const key = `${temp ?? "na"}::${value}`;
    if (!merged.has(key)) merged.set(key, row);
  }

  return [...merged.values()].sort((a, b) => {
    const at = Number.isFinite(a?.[tempKey])
      ? a[tempKey]
      : Number.POSITIVE_INFINITY;
    const bt = Number.isFinite(b?.[tempKey])
      ? b[tempKey]
      : Number.POSITIVE_INFINITY;
    return at - bt;
  });
}

function mergeCompoundDocs(base, extra) {
  const dois = [
    ...new Set(
      [...(base.dois ?? []), ...(extra.dois ?? []), base.doi, extra.doi].filter(
        Boolean,
      ),
    ),
  ];

  const merged = {
    ...base,
    category: base.category !== "Unknown" ? base.category : extra.category,
    doi: dois[0] ?? null,
    dois,
    source_status:
      base.source_status === "success" || extra.source_status === "success"
        ? "success"
        : base.source_status,
    temperature_data: mergeByTempValue(
      base.temperature_data,
      extra.temperature_data,
      "zt",
      "temp",
    ).map((p) => ({
      temp: p.temp,
      zt: p.zt,
    })),
    measurements: {
      seebeck: mergeByTempValue(
        base.measurements?.seebeck,
        extra.measurements?.seebeck,
        "value_uV_per_K",
      ),
      conductivity: mergeByTempValue(
        base.measurements?.conductivity,
        extra.measurements?.conductivity,
        "value_S_per_m",
      ),
      thermal_conductivity: mergeByTempValue(
        base.measurements?.thermal_conductivity,
        extra.measurements?.thermal_conductivity,
        "value_W_per_mK",
      ),
      power_factor: mergeByTempValue(
        base.measurements?.power_factor,
        extra.measurements?.power_factor,
        "value",
      ),
      zt: mergeByTempValue(
        base.measurements?.zt,
        extra.measurements?.zt,
        "value",
      ),
    },
  };

  merged.seebeck = pickRepresentativeValue(
    merged.measurements.seebeck,
    "value_uV_per_K",
  );
  merged.conductivity = pickRepresentativeValue(
    merged.measurements.conductivity,
    "value_S_per_m",
  );
  merged.thermal_conductivity = pickRepresentativeValue(
    merged.measurements.thermal_conductivity,
    "value_W_per_mK",
  );
  merged.zt = merged.measurements.zt.length
    ? Math.max(
        ...merged.measurements.zt
          .map((z) => z.value)
          .filter((v) => Number.isFinite(v)),
      )
    : null;

  return merged;
}

function getPowerFactorRepresentative(doc) {
  return pickRepresentativeValue(doc?.measurements?.power_factor, "value");
}

function evaluateQuality(doc) {
  const values = [
    doc?.seebeck,
    doc?.conductivity,
    doc?.thermal_conductivity,
    getPowerFactorRepresentative(doc),
    doc?.zt,
  ];

  const totalProps = values.length;
  const knownValues = values.filter((v) => Number.isFinite(v));
  const knownCount = knownValues.length;

  const completeness = knownCount / totalProps;
  const zeroCount = knownValues.filter((v) => v === 0).length;
  const zeroRatio = knownCount > 0 ? zeroCount / knownCount : 0;

  const rejectForCompleteness = completeness < MIN_PROPERTY_COMPLETENESS;
  const rejectForZeros = knownCount > 0 && zeroRatio > MAX_ZERO_RATIO;

  return {
    accepted: !rejectForCompleteness && !rejectForZeros,
    completeness,
    zeroRatio,
    rejectForCompleteness,
    rejectForZeros,
  };
}

async function main() {
  const { dir } = parseArgs(process.argv);
  const client = new MongoClient(mongoUri);
  await client.connect();

  const col = client.db(dbName).collection(collectionName);

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"))
    .map((e) => path.join(dir, e.name));

  if (files.length === 0) {
    console.log(`No .json files found in ${dir}`);
    await client.close();
    return;
  }

  let parsed = 0;
  let skipped = 0;
  let upserted = 0;
  let rejectedByCompleteness = 0;
  let rejectedByZeroRatio = 0;
  let deletedRejected = 0;
  const groupedByCompound = new Map();
  const rejectedNames = [];

  for (const filePath of files) {
    try {
      const text = await fs.readFile(filePath, "utf8");
      const json = JSON.parse(text);
      const docs = buildDocsFromExtract(json);

      for (const doc of docs) {
        doc.dois = doc.doi ? [doc.doi] : [];
        const prev = groupedByCompound.get(doc.name);
        groupedByCompound.set(
          doc.name,
          prev ? mergeCompoundDocs(prev, doc) : doc,
        );
      }

      parsed += 1;
    } catch (error) {
      skipped += 1;
      console.warn(`Skipped ${path.basename(filePath)}: ${error.message}`);
    }
  }

  for (const doc of groupedByCompound.values()) {
    const quality = evaluateQuality(doc);
    if (!quality.accepted) {
      if (quality.rejectForCompleteness) rejectedByCompleteness += 1;
      if (quality.rejectForZeros) rejectedByZeroRatio += 1;
      rejectedNames.push(doc.name);
      continue;
    }

    await col.updateOne(
      { name: doc.name },
      {
        $set: {
          doi: doc.doi,
          dois: doc.dois ?? [],
          source_status: doc.source_status,
          category: doc.category,
          seebeck: doc.seebeck,
          conductivity: doc.conductivity,
          thermal_conductivity: doc.thermal_conductivity,
          zt: doc.zt,
          temperature_data: doc.temperature_data,
          measurements: doc.measurements,
          source_json: doc.source_json,
        },
        $setOnInsert: {
          created_at: doc.created_at,
        },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  if (rejectedNames.length > 0) {
    const deleteResult = await col.deleteMany({ name: { $in: rejectedNames } });
    deletedRejected = deleteResult.deletedCount ?? 0;
  }

  console.log("Mongo JSON import complete.");
  console.log(`Files parsed: ${parsed}`);
  console.log(`Files skipped: ${skipped}`);
  console.log(`Documents upserted: ${upserted}`);
  console.log(`Documents rejected (<25% properties): ${rejectedByCompleteness}`);
  console.log(`Documents rejected (>50% zero values): ${rejectedByZeroRatio}`);
  console.log(`Rejected documents removed from DB: ${deletedRejected}`);

  await client.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
