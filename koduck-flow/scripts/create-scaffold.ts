import { constants as fsConstants, promises as fs } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");

type ScaffoldType = "manager" | "plugin" | "runtime";

type TemplateContext = {
  readonly rawName: string;
  readonly pascalName: string;
  readonly camelName: string;
  readonly kebabName: string;
};

type TemplateDefinition = {
  readonly sourceDir: string;
  readonly testDir: string;
  readonly sourceFileName: (ctx: TemplateContext) => string;
  readonly testFileName: (ctx: TemplateContext) => string;
  readonly buildSource: (ctx: TemplateContext) => string;
  readonly buildTest: (ctx: TemplateContext) => string;
};

const templates: Record<ScaffoldType, TemplateDefinition> = {
  manager: {
    sourceDir: "src/common/manager",
    testDir: "test/common/manager",
    sourceFileName: (ctx) => `${ctx.kebabName}-manager.ts`,
    testFileName: (ctx) => `${ctx.kebabName}-manager.test.ts`,
    buildSource: (ctx) => `import type { DuckFlowRuntime, IManager } from "../runtime";

export class ${ctx.pascalName}Manager implements IManager {
  readonly name = "${ctx.camelName}";
  readonly type = "${ctx.kebabName}";

  constructor(private readonly runtime: DuckFlowRuntime) {}

  initialize(): void {
    // TODO: wire runtime managers or register services.
  }

  dispose(): void {
    // TODO: clean up resources allocated during initialize.
  }
}
`,
    buildTest: (ctx) => `import { describe, expect, it } from "vitest";
import type { DuckFlowRuntime } from "../../../src/common/runtime";
import { ${ctx.pascalName}Manager } from "../../../src/common/manager/${ctx.kebabName}-manager";

describe("${ctx.pascalName}Manager", () => {
  it("exposes metadata", () => {
    const runtime = { dispose: () => undefined } as unknown as DuckFlowRuntime;
    const manager = new ${ctx.pascalName}Manager(runtime);

    expect(manager.name).toBe("${ctx.camelName}");
    expect(manager.type).toBe("${ctx.kebabName}");
  });
});
`,
  },
  plugin: {
    sourceDir: "src/common/plugin",
    testDir: "test/common/plugin",
    sourceFileName: (ctx) => `${ctx.kebabName}-plugin.ts`,
    testFileName: (ctx) => `${ctx.kebabName}-plugin.test.ts`,
    buildSource: (ctx) => `import type { PluginLifecycle } from "./sandbox-runner";

type ${ctx.pascalName}PluginMetadata = {
  readonly featureFlag?: string;
};

type ${ctx.pascalName}PluginInitContext = {
  readonly metadata: ${ctx.pascalName}PluginMetadata;
};

type ${ctx.pascalName}PluginAttachContext = {
  readonly runtimeId: string;
};

type ${ctx.pascalName}PluginDisposeContext = {
  readonly reason?: string;
};

export function create${ctx.pascalName}Plugin(): PluginLifecycle<
  ${ctx.pascalName}PluginInitContext,
  ${ctx.pascalName}PluginAttachContext,
  ${ctx.pascalName}PluginDisposeContext
> {
  return {
    async onInit(context) {
      if (context?.metadata?.featureFlag) {
        console.debug("[${ctx.pascalName}Plugin] init feature flag", context.metadata.featureFlag);
      }
    },
    async onAttach(context) {
      console.info("[${ctx.pascalName}Plugin] attached to runtime", context?.runtimeId);
    },
    async onDispose(context) {
      console.info("[${ctx.pascalName}Plugin] disposed", context?.reason ?? "normal");
    },
  } satisfies PluginLifecycle<
    ${ctx.pascalName}PluginInitContext,
    ${ctx.pascalName}PluginAttachContext,
    ${ctx.pascalName}PluginDisposeContext
  >;
}
`,
    buildTest: (ctx) => `import { describe, expect, it } from "vitest";
import { create${ctx.pascalName}Plugin } from "../../../src/common/plugin/${ctx.kebabName}-plugin";

const lifecycle = create${ctx.pascalName}Plugin();

describe("${ctx.pascalName}Plugin", () => {
  it("returns lifecycle handlers", () => {
    expect(typeof lifecycle.onInit).toBe("function");
    expect(typeof lifecycle.onAttach).toBe("function");
    expect(typeof lifecycle.onDispose).toBe("function");
  });
});
`,
  },
  runtime: {
    sourceDir: "src/common/runtime",
    testDir: "test/common/runtime",
    sourceFileName: (ctx) => `${ctx.kebabName}-runtime.ts`,
    testFileName: (ctx) => `${ctx.kebabName}-runtime.test.ts`,
    buildSource: (ctx) => `import {
  createDuckFlowRuntime,
  type DuckFlowRuntime,
  type RuntimeCreationOptions,
} from "./duck-flow-runtime";

export interface ${ctx.pascalName}RuntimeOptions extends RuntimeCreationOptions {
  readonly label?: string;
}

export function create${ctx.pascalName}Runtime(options: ${ctx.pascalName}RuntimeOptions = {}): DuckFlowRuntime {
  const runtime = createDuckFlowRuntime(options);

  if (options.label) {
    runtime.Logger?.info?.({
      event: "runtime-created",
      metadata: {
        label: options.label,
        factory: "${ctx.pascalName}Runtime",
      },
    });
  }

  return runtime;
}
`,
    buildTest: (ctx) => `import { describe, expect, it } from "vitest";
import { create${ctx.pascalName}Runtime } from "../../../src/common/runtime/${ctx.kebabName}-runtime";

describe("create${ctx.pascalName}Runtime", () => {
  it("creates a runtime instance", () => {
    const runtime = create${ctx.pascalName}Runtime();

    expect(typeof runtime).toBe("object");
    expect(typeof runtime.dispose).toBe("function");

    runtime.dispose();
  });
});
`,
  },
};

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const typeArg = argv[0];
  if (!isScaffoldType(typeArg)) {
    console.error(`Unknown scaffold type '${typeArg}'.`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  const flagArgs = argv.slice(1).filter((value) => value.startsWith("--"));
  const nameArg = argv.slice(1).find((value) => !value.startsWith("--"));

  const options = {
    dryRun: flagArgs.includes("--dry-run"),
    force: flagArgs.includes("--force"),
  } as const;

  const rawName = await resolveName(nameArg, typeArg);
  const context = createTemplateContext(rawName);
  const template = templates[typeArg];

  const sourcePath = path.join(packageRoot, template.sourceDir, template.sourceFileName(context));
  const testPath = path.join(packageRoot, template.testDir, template.testFileName(context));

  const createdFiles: string[] = [];

  await ensureWritable(sourcePath, options.force, options.dryRun);
  await ensureWritable(testPath, options.force, options.dryRun);

  if (!options.dryRun) {
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.writeFile(sourcePath, template.buildSource(context), { encoding: "utf8" });
    createdFiles.push(path.relative(packageRoot, sourcePath));

    await fs.mkdir(path.dirname(testPath), { recursive: true });
    await fs.writeFile(testPath, template.buildTest(context), { encoding: "utf8" });
    createdFiles.push(path.relative(packageRoot, testPath));
  }

  const header = options.dryRun ? "[dry-run] Generated" : "Generated";

  console.info(`${header} ${typeArg} scaffold for "${context.rawName}":`);
  console.info(`  Source: ${path.relative(packageRoot, sourcePath)}`);
  console.info(`  Test:   ${path.relative(packageRoot, testPath)}`);

  if (!options.dryRun) {
    console.info("Files created:");
    for (const file of createdFiles) {
      console.info(`  - ${file}`);
    }
  }
}

function isScaffoldType(value: string): value is ScaffoldType {
  return value === "manager" || value === "plugin" || value === "runtime";
}

async function resolveName(argument: string | undefined, type: ScaffoldType): Promise<string> {
  if (argument && argument.trim().length > 0) {
    return argument.trim();
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Enter ${type} name: `);
  rl.close();

  const normalized = answer.trim();
  if (!normalized) {
    console.error("Name is required to generate scaffold.");
    process.exit(1);
  }

  return normalized;
}

function createTemplateContext(rawName: string): TemplateContext {
  const cleaned = rawName.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

  if (words.length === 0) {
    throw new Error(`Unable to derive identifiers from name '${rawName}'.`);
  }

  const pascalName = words.map(capitalize).join("");
  const camelName = words[0] + words.slice(1).map(capitalize).join("");
  const kebabName = words.join("-");

  return {
    rawName,
    pascalName,
    camelName,
    kebabName,
  } satisfies TemplateContext;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

async function ensureWritable(filePath: string, force: boolean, dryRun: boolean): Promise<void> {
  try {
    await fs.access(filePath, fsConstants.F_OK);
    if (!force && !dryRun) {
      console.error(
        `File already exists: ${path.relative(packageRoot, filePath)} (use --force to overwrite).`
      );
      process.exit(1);
    }
  } catch {
    // file does not exist - ok
  }
}

function printUsage(): void {
  console.info("Usage: pnpm run create:<type> -- <Name> [--dry-run] [--force]");
  console.info("  <type> one of: manager | plugin | runtime");
  console.info("  example: pnpm run create:plugin -- realtime sync");
}

void main().catch((error) => {
  console.error("Failed to generate scaffold:", error);
  process.exitCode = 1;
});
