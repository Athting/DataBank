import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    input: path.resolve(process.cwd(), "JSONS", "SnSe.json"),
    output: path.resolve(
      process.cwd(),
      "JSONS",
      "_import_single",
      "SnSe_extracted.json",
    ),
  };

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--input" && argv[i + 1]) {
      args.input = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }

    if (argv[i] === "--output" && argv[i + 1]) {
      args.output = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

function canonicalProperty(prop) {
  const p = (prop ?? "").toString().trim().toLowerCase();
  if (p === "seebeck") return "seebeck";
  if (p === "conductivity") return "conductivity";
  if (p === "thermcond" || p === "thermal_conductivity" || p === "thermal conductivity") return "thermal_conductivity";
  if (p === "pf" || p === "power_factor" || p === "power factor") return "power_factor";
  if (p === "zt") return "zt";
  return null;
}

function toSafeString(value) {
  return value === null || value === undefined ? "" : String(value);
}

async function main() {
  const { input: inputPath, output: outputPath } = parseArgs(process.argv);

  const raw = await fs.readFile(inputPath, "utf8");
  const source = JSON.parse(raw);

  const materialName = source?.Material ?? "Unknown";
  const temperatures = source?.Data_By_Temperature ?? {};

  const materials = new Set();
  const seebeck_data = [];
  const conductivity_data = [];
  const thermal_conductivity_data = [];
  const power_factor_data = [];
  const zt_data = [];

  for (const [temp, rows] of Object.entries(temperatures)) {
    if (!Array.isArray(rows)) continue;

    for (const row of rows) {
      const name = toSafeString(row?.Original_Name_In_Paper).trim() || materialName;
      materials.add(name);

      const property = canonicalProperty(row?.Property);
      if (!property) continue;

      const entry = {
        material: name,
        value: row?.Value,
        unit: row?.Units ?? null,
        temperature: `${temp} K`,
      };

      if (property === "seebeck") seebeck_data.push(entry);
      if (property === "conductivity") conductivity_data.push(entry);
      if (property === "thermal_conductivity") thermal_conductivity_data.push(entry);
      if (property === "power_factor") power_factor_data.push(entry);
      if (property === "zt") {
        zt_data.push({
          material: name,
          zt_value: row?.Value,
          temperature: `${temp} K`,
        });
      }
    }
  }

  if (materials.size === 0) {
    materials.add(materialName);
  }

  const out = {
    doi: Array.isArray(source?.DOIs_Researched) && source.DOIs_Researched.length > 0 ? source.DOIs_Researched[0] : null,
    extraction_status: "success",
    extracted_data: {
      material_composition: {
        materials: [...materials],
      },
      seebeck_coefficient: {
        seebeck_data,
      },
      electrical_conductivity: {
        conductivity_data,
      },
      thermal_conductivity: {
        thermal_conductivity_data,
      },
      power_factor: {
        power_factor_data,
      },
      figure_of_merit_ZT: {
        zt_data,
      },
      temperature: {
        temperature_data: [],
      },
      crystal_structure: {
        crystal_data: [],
      },
      space_group: {
        space_group_data: [],
      },
      lattice_parameters: {
        lattice_data: [],
      },
    },
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote converted file: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
