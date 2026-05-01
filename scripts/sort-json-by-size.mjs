import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    inputDir: path.resolve(process.cwd(), "JSONS", "_import_grouped"),
    outputDir: path.resolve(
      process.cwd(),
      "JSONS",
      "_import_grouped_sorted_by_size",
    ),
    order: "asc",
  };

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--input-dir" && argv[i + 1]) {
      args.inputDir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }

    if (argv[i] === "--output-dir" && argv[i + 1]) {
      args.outputDir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
      continue;
    }

    if (argv[i] === "--order" && argv[i + 1]) {
      const requested = argv[i + 1].toLowerCase();
      if (requested === "asc" || requested === "desc") {
        args.order = requested;
      }
      i += 1;
    }
  }

  return args;
}

function formatRank(index, width) {
  return String(index).padStart(width, "0");
}

function formatSizeBytes(bytes) {
  return String(bytes).padStart(12, "0");
}

async function main() {
  const { inputDir, outputDir, order } = parseArgs(process.argv);

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const jsonFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"),
  );

  if (jsonFiles.length === 0) {
    console.log(`No .json files found in ${inputDir}`);
    return;
  }

  const filesWithSize = [];
  for (const entry of jsonFiles) {
    const sourcePath = path.join(inputDir, entry.name);
    const stat = await fs.stat(sourcePath);
    filesWithSize.push({
      name: entry.name,
      sourcePath,
      sizeBytes: stat.size,
    });
  }

  filesWithSize.sort((a, b) => {
    if (a.sizeBytes !== b.sizeBytes) {
      return order === "asc"
        ? a.sizeBytes - b.sizeBytes
        : b.sizeBytes - a.sizeBytes;
    }
    return a.name.localeCompare(b.name);
  });

  await fs.mkdir(outputDir, { recursive: true });

  const rankWidth = String(filesWithSize.length).length;
  const manifest = [];

  for (let i = 0; i < filesWithSize.length; i += 1) {
    const file = filesWithSize[i];
    const rank = i + 1;
    const rankedName = `${formatRank(rank, rankWidth)}__${formatSizeBytes(file.sizeBytes)}B__${file.name}`;
    const targetPath = path.join(outputDir, rankedName);

    await fs.copyFile(file.sourcePath, targetPath);

    manifest.push({
      rank,
      file_name: file.name,
      sorted_file_name: rankedName,
      size_bytes: file.sizeBytes,
    });
  }

  const manifestPath = path.join(outputDir, "_size_manifest.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        input_dir: inputDir,
        output_dir: outputDir,
        order,
        total_files: filesWithSize.length,
        generated_at: new Date().toISOString(),
        files: manifest,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("Sorting complete.");
  console.log(`Input directory: ${inputDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Order: ${order}`);
  console.log(`Files copied: ${filesWithSize.length}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
