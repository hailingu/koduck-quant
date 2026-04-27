import type { LlmModelOption, LlmOptionsConfig, LlmProvider, LlmProviderOption, RuntimeConfig, RuntimeLlmProviderConfig } from "./types";

const FALLBACK_RUNTIME_LLM_PROVIDERS: RuntimeLlmProviderConfig[] = [
  {
    value: "minimax",
    label: "MiniMax",
    defaultModel: "MiniMax-M2.7",
    models: ["MiniMax-M2.7", "MiniMax-M2.5"],
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
  {
    value: "kimi",
    label: "Kimi",
    defaultModel: "kimi-for-coding",
    models: ["kimi-for-coding"],
  },
];

export const RUNTIME_CONFIG_URL = "/runtime-config.json";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeModelOptions(models: unknown, defaultModel: string): LlmModelOption[] {
  const rawModels = Array.isArray(models) ? models : [];
  const options = rawModels
    .map((model) => {
      if (typeof model === "string") {
        const value = model.trim();
        return value ? { value, label: value } : null;
      }
      if (!model || typeof model !== "object") {
        return null;
      }
      const item = model as Record<string, unknown>;
      const value = normalizeString(item.value);
      if (!value) {
        return null;
      }
      return {
        value,
        label: normalizeString(item.label) || value,
      };
    })
    .filter((option): option is LlmModelOption => option !== null);

  if (defaultModel && !options.some((option) => option.value === defaultModel)) {
    return [{ value: defaultModel, label: defaultModel }, ...options];
  }

  return options;
}

export function normalizeLlmOptions(rawConfig: unknown): LlmOptionsConfig {
  const config = rawConfig && typeof rawConfig === "object" ? (rawConfig as RuntimeConfig) : {};
  const rawProviders = Array.isArray(config.llm?.providers)
    ? config.llm.providers
    : FALLBACK_RUNTIME_LLM_PROVIDERS;

  const providerOptions: LlmProviderOption[] = [];
  const modelOptionsByProvider: Record<LlmProvider, LlmModelOption[]> = {};

  for (const rawProvider of rawProviders) {
    if (!rawProvider || typeof rawProvider !== "object") {
      continue;
    }

    const provider = rawProvider as RuntimeLlmProviderConfig;
    const value = normalizeString(provider.value);
    if (!value) {
      continue;
    }

    const defaultModel = normalizeString(provider.defaultModel);
    const models = normalizeModelOptions(provider.models, defaultModel);
    if (models.length === 0) {
      continue;
    }

    providerOptions.push({
      value,
      label: normalizeString(provider.label) || value,
    });
    modelOptionsByProvider[value] = models;
  }

  if (providerOptions.length === 0) {
    return normalizeLlmOptions({ llm: { providers: FALLBACK_RUNTIME_LLM_PROVIDERS } });
  }

  const configuredDefaultProvider = normalizeString(config.llm?.defaultProvider);
  const defaultProvider = providerOptions.some(
    (provider) => provider.value === configuredDefaultProvider,
  )
    ? configuredDefaultProvider
    : providerOptions[0].value;

  return {
    defaultProvider,
    providerOptions,
    modelOptionsByProvider,
  };
}

export const FALLBACK_LLM_OPTIONS = normalizeLlmOptions({
  llm: { defaultProvider: "minimax", providers: FALLBACK_RUNTIME_LLM_PROVIDERS },
});
