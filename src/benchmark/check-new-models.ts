import { readFileSync, writeFileSync } from "fs";
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

function findNewModels(
  openrouterModels: any[],
  config: BenchmarkConfig
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

    if (!testedModels.has(modelKey)) {
      newModels.push({
        provider,
        model: modelName,
        modelId: model.id,
        created: model.created
      });
    }
  }

  return newModels;
}

async function main() {
  try {
    console.log("🔍 Checking for new OpenRouter models...\n");

    const openrouterModels = await fetchOpenRouterModels();
    const config = await loadBenchmarkConfig();
    const testedCount = Object.values(config.providers).reduce((sum, data) => sum + data.models.length, 0);

    const newModels = findNewModels(openrouterModels, config);

    console.log(`📊 Found ${newModels.length} untested models:\n`);

    if (newModels.length === 0) {
      console.log("✅ All OpenRouter models have been benchmarked.");
      console.log(`📈 Current status:`);
      console.log(`   - Tested models: ${testedCount}`);
      console.log(`   - Total OpenRouter models: ${openrouterModels.length}`);
      return;
    }

    const groupedByProvider = newModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, NewModel[]>);

    for (const [provider, models] of Object.entries(groupedByProvider)) {
      console.log(`📁 ${provider} (${models.length} models):`);
      for (const model of models) {
        console.log(`  - ${model.model} (${model.modelId})`);
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
