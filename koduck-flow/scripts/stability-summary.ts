import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  StabilityOptions,
  StabilityReport,
  StabilityTrend,
  StabilityTrendEntry,
  summariseStability,
  updateStabilityTrend,
} from "../src/common/monitoring/stability-metrics";

interface CliOptions extends StabilityOptions {
  input: string;
  trendOut: string;
  alertsOut: string;
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
      continue;
    }

    switch (key) {
      case "input":
        options.input = value!;
        break;
      case "trend-out":
        options.trendOut = value!;
        break;
      case "alerts-out":
        options.alertsOut = value!;
        break;
      case "error-threshold":
        options.errorThreshold = Number.parseFloat(value!);
        break;
      case "stability-threshold":
        options.stabilityScoreThreshold = Number.parseFloat(value!);
        break;
      case "window-size":
        options.windowSize = Number.parseInt(value!, 10);
        break;
      default:
        break;
    }

    if (inlineValue === undefined && peek && !peek.startsWith("--")) {
      index += 1;
    }
  }

  return {
    input: options.input ?? path.join(PACKAGE_ROOT, "stability-report.json"),
    trendOut: options.trendOut ?? path.join(PACKAGE_ROOT, "reports", "stability-trend.json"),
    alertsOut: options.alertsOut ?? path.join(PACKAGE_ROOT, "reports", "stability-alerts.json"),
    errorThreshold: options.errorThreshold,
    stabilityScoreThreshold: options.stabilityScoreThreshold,
    windowSize: options.windowSize,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
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

async function main(): Promise<void> {
  const options = parseCliArgs();
  const report = await readJsonFile<StabilityReport>(options.input);

  if (!report) {
    console.error(`Unable to read stability report: ${options.input}`);
    process.exitCode = 2;
    return;
  }

  const entry: StabilityTrendEntry = summariseStability(report);
  const existingTrend = await readJsonFile<StabilityTrend>(options.trendOut);
  const trend = updateStabilityTrend(existingTrend, entry, options);

  await writeFile(options.trendOut, `${JSON.stringify(trend, null, 2)}\n`);
  await writeFile(options.alertsOut, `${JSON.stringify(trend.alerts, null, 2)}\n`);

  if (trend.alerts.length > 0) {
    console.warn(`Stability alerts generated: ${trend.alerts.length}`);
  } else {
    console.log("Stability trend updated with no alerts.");
  }
}

main().catch((error) => {
  console.error("Failed to process stability summary", error);
  process.exitCode = 1;
});
