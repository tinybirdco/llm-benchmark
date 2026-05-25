import { readFileSync, writeFileSync, existsSync } from "fs";
import { fetchOpenRouterModels, extractProviderFromModelId, isTextOutputModel } from "./fetch-openrouter-models";

interface BenchmarkConfig {
  providers: {
    [provider: string]: {
      models: string[];
    };
  };
}

interface NewModel {
  provider: string;
  model: string;
  modelId: string;
  created?: number;
}

const PRIORITY_PROVIDERS = [
  "anthropic",
  "google",
  "openai",
  "mistralai",
  "perplexity",
  "x-ai",
  "deepseek",
  "meta-llama",
  "moonshotai",
];

function sortByProviderPriority(models: NewModel[]): NewModel[] {
  const prioritySet = new Set(PRIORITY_PROVIDERS);
  const priority: NewModel[] = [];
  const rest: NewModel[] = [];

  for (const m of models) {
    if (prioritySet.has(m.provider)) {
      priority.push(m);
    } else {
      rest.push(m);
    }
  }

  priority.sort((a, b) => {
    return PRIORITY_PROVIDERS.indexOf(a.provider) - PRIORITY_PROVIDERS.indexOf(b.provider);
  });

  return [...priority, ...rest];
}

async function loadBenchmarkConfig(): Promise<BenchmarkConfig> {
  try {
    const configPath = "benchmark-config.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config;
  } catch (error) {
    console.error("Error reading benchmark-config.json:", error);
    throw error;
  }
}

function loadFailedModelKeys(): Set<string> {
  const keys = new Set<string>();
  try {
    if (!existsSync("failed-models.json")) {
      return keys;
    }
    const data = JSON.parse(readFileSync("failed-models.json", "utf-8"));
    for (const m of data.models ?? []) {
      keys.add(`${m.provider}/${m.model}`);
    }
  } catch (error) {
    console.warn("Warning: could not read failed-models.json:", error);
  }
  return keys;
}

function findNewModels(
  openrouterModels: any[],
  config: BenchmarkConfig,
  failedKeys: Set<string> = new Set()
): NewModel[] {
  const newModels: NewModel[] = [];

  const testedModels = new Set<string>();

  for (const [provider, data] of Object.entries(config.providers)) {
    for (const model of data.models) {
      testedModels.add(`${provider}/${model}`);
    }
  }

  for (const model of openrouterModels) {
    const provider = extractProviderFromModelId(model.id);
    const modelName = model.id.includes("/") ? model.id.split("/")[1] : model.id;
    const modelKey = `${provider}/${modelName}`;

    if (testedModels.has(modelKey)) continue;
    if (failedKeys.has(modelKey)) continue;

    newModels.push({
      provider,
      model: modelName,
      modelId: model.id,
      created: model.created
    });
  }

  return newModels;
}

async function main() {
  try {
    console.log("🔍 Checking for new OpenRouter models...\n");

    const openrouterModels = await fetchOpenRouterModels();
    const config = await loadBenchmarkConfig();
    const failedKeys = loadFailedModelKeys();
    const testedCount = Object.values(config.providers).reduce((sum, data) => sum + data.models.length, 0);

    const newModels = sortByProviderPriority(findNewModels(openrouterModels, config, failedKeys));

    console.log(`📊 Found ${newModels.length} untested models (excluded ${failedKeys.size} previously failed):\n`);

    if (newModels.length === 0) {
      console.log("✅ All OpenRouter models have been benchmarked.");
      console.log(`📈 Current status:`);
      console.log(`   - Tested models: ${testedCount}`);
      console.log(`   - Total OpenRouter models: ${openrouterModels.length}`);
      return;
    }

    const prioritySet = new Set(PRIORITY_PROVIDERS);
    const priorityModels = newModels.filter(m => prioritySet.has(m.provider));
    const otherModels = newModels.filter(m => !prioritySet.has(m.provider));

    if (priorityModels.length > 0) {
      console.log(`⭐ Priority providers (${priorityModels.length} models):`);
      const grouped = priorityModels.reduce((acc, m) => {
        (acc[m.provider] ??= []).push(m);
        return acc;
      }, {} as Record<string, NewModel[]>);
      for (const [provider, models] of Object.entries(grouped)) {
        console.log(`  📁 ${provider} (${models.length}):`);
        for (const model of models) {
          console.log(`    - ${model.model}`);
        }
      }
      console.log();
    }

    if (otherModels.length > 0) {
      console.log(`📁 Other providers (${otherModels.length} models):`);
      const grouped = otherModels.reduce((acc, m) => {
        (acc[m.provider] ??= []).push(m);
        return acc;
      }, {} as Record<string, NewModel[]>);
      for (const [provider, models] of Object.entries(grouped)) {
        console.log(`  📁 ${provider} (${models.length}):`);
        for (const model of models) {
          console.log(`    - ${model.model}`);
        }
      }
      console.log();
    }

    const newModelsJson = {
      generated_at: new Date().toISOString(),
      total_count: newModels.length,
      models: newModels
    };
    writeFileSync("new-models.json", JSON.stringify(newModelsJson, null, 2));
    console.log("📄 Generated new models list: new-models.json");

    // Exit with code 10 to indicate new models were found (distinct from error code 1)
    process.exit(10);

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { findNewModels };
