import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createTrendEntriesFromReport,
  generateMonthlyDigest,
  PerformanceTrend,
  TrendEntry,
  updatePerformanceTrend,
} from "../src/common/monitoring/performance-trend";

interface CliOptions {
  input: string;
  trendOut: string;
  digestOut: string;
  scenarios: string[] | undefined;
  windowSize?: number;
  regressionThresholdPercent?: number;
  maxAlerts?: number;
}

interface BenchmarkReportFile {
  generatedAt?: string;
  results?: unknown;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {};

  for (let index = 0; index < args.length; ) {
    const arg = args[index];
    index += 1;
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.split("=", 2);
    const key = rawKey.replace(/^--/, "");

    const peek = args[index];
    const value = inlineValue ?? peek;
    if (inlineValue === undefined && (!value || value.startsWith("--"))) {
      options[key as keyof CliOptions] = true as unknown as never;
      continue;
    }

    switch (key) {
      case "input":
        options.input = value!;
        break;
      case "trend-out":
        options.trendOut = value!;
        break;
      case "digest-out":
        options.digestOut = value!;
        break;
      case "scenarios":
        options.scenarios = value
          ?.split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        break;
      case "window-size":
        options.windowSize = Number.parseInt(value!, 10);
        break;
      case "regression-threshold":
        options.regressionThresholdPercent = Number.parseFloat(value!);
        break;
      case "max-alerts":
        options.maxAlerts = Number.parseInt(value!, 10);
        break;
      default:
        break;
    }

    if (inlineValue === undefined && peek && !peek.startsWith("--")) {
      index += 1;
    }
  }

  return {
    input: options.input ?? path.join(PACKAGE_ROOT, "benchmarks", "report.json"),
    trendOut: options.trendOut ?? path.join(PACKAGE_ROOT, "reports", "performance-trend.json"),
    digestOut: options.digestOut ?? path.join(PACKAGE_ROOT, "reports", "performance-digest.md"),
    scenarios: options.scenarios,
    windowSize: options.windowSize,
    regressionThresholdPercent: options.regressionThresholdPercent,
    maxAlerts: options.maxAlerts,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function updateTrend(
  trend: PerformanceTrend | undefined,
  entries: TrendEntry[],
  options: CliOptions
): Promise<PerformanceTrend> {
  let currentTrend = trend;
  for (const entry of entries) {
    currentTrend = updatePerformanceTrend(currentTrend, entry, {
      windowSize: options.windowSize,
      regressionThresholdPercent: options.regressionThresholdPercent,
    });
  }
  return currentTrend!;
}

async function main(): Promise<void> {
  const options = parseCliArgs();
  const report = await readJsonFile<BenchmarkReportFile>(options.input);

  if (!report || !Array.isArray(report.results)) {
    console.error(`Unable to read benchmark report: ${options.input}`);
    process.exitCode = 2;
    return;
  }

  const entries = createTrendEntriesFromReport(report as never, options.scenarios);
  if (entries.length === 0) {
    console.warn("No matching benchmark scenarios found; trend not updated.");
    return;
  }

  const existingTrend = await readJsonFile<PerformanceTrend>(options.trendOut);
  const updatedTrend = await updateTrend(existingTrend, entries, options);

  await writeFile(options.trendOut, `${JSON.stringify(updatedTrend, null, 2)}\n`);

  const digest = generateMonthlyDigest(updatedTrend, {
    scenarios: options.scenarios,
    maxAlerts: options.maxAlerts,
  });
  await writeFile(options.digestOut, `${digest}\n`);

  console.log(`Performance trend updated with ${entries.length} scenario(s).`);
  console.log(`Trend file: ${options.trendOut}`);
  console.log(`Digest file: ${options.digestOut}`);
}

main().catch((error) => {
  console.error("Failed to update performance monitoring artefacts", error);
  process.exitCode = 1;
});
