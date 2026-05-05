import { readFileSync, writeFileSync, existsSync } from "fs";
import { fetchOpenRouterModels, extractProviderFromModelId, isTextOutputModel } from "./fetch-openrouter-models";

interface BenchmarkConfig {
  providers: {
    [provider: string]: {
      models: string[];
    };
  };
}

interface UntestedModel {
  provider: string;
  model: string;
  modelId: string;
  created?: number;
}

interface UntestedModelsData {
  generated_at: string;
  total_count: number;
  models: UntestedModel[];
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

async function loadUntestedModels(): Promise<UntestedModel[]> {
  try {
    const untestedPath = "untested-models.json";
    const data: UntestedModelsData = JSON.parse(readFileSync(untestedPath, "utf-8"));
    return data.models;
  } catch (error) {
    console.error("Error reading untested-models.json:", error);
    return [];
  }
}

function loadFailedModels(): UntestedModel[] {
  try {
    const failedPath = "failed-models.json";
    if (!existsSync(failedPath)) {
      return [];
    }
    const data = JSON.parse(readFileSync(failedPath, "utf-8"));
    return data.models || [];
  } catch (error) {
    console.error("Error reading failed-models.json:", error);
    return [];
  }
}

function findNewModels(
  openrouterModels: any[], 
  config: BenchmarkConfig, 
  existingUntestedModels: UntestedModel[]
): UntestedModel[] {
  const newModels: UntestedModel[] = [];
  
  // Create sets for faster lookup
  const testedModels = new Set<string>();
  const untestedModels = new Set<string>();
  const failedModels = new Set<string>();
  
  // Add tested models to set
  for (const [provider, data] of Object.entries(config.providers)) {
    for (const model of data.models) {
      testedModels.add(`${provider}/${model}`);
    }
  }
  
  // Add existing untested models to set
  for (const model of existingUntestedModels) {
    untestedModels.add(`${model.provider}/${model.model}`);
  }
  
  // Add failed models to set
  const failedModelsList = loadFailedModels();
  for (const model of failedModelsList) {
    failedModels.add(`${model.provider}/${model.model}`);
  }
  
  // Check each OpenRouter model
  for (const model of openrouterModels) {
    const provider = extractProviderFromModelId(model.id);
    const modelName = model.id.includes("/") ? model.id.split("/")[1] : model.id;
    const modelKey = `${provider}/${modelName}`;

    // If not tested, not in untested list, and not failed, it's new
    if (!testedModels.has(modelKey) && !untestedModels.has(modelKey) && !failedModels.has(modelKey)) {
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
    
    // Fetch models from OpenRouter
    const openrouterModels = await fetchOpenRouterModels();
    
    // Load current benchmark config
    const config = await loadBenchmarkConfig();
    
    // Load existing untested models
    const existingUntestedModels = await loadUntestedModels();
    
    // Find truly new models
    const newModels = findNewModels(openrouterModels, config, existingUntestedModels);
    
    console.log(`📊 Found ${newModels.length} new models:\n`);
    
    if (newModels.length === 0) {
      console.log("✅ No new models found. All OpenRouter models are either tested or in the untested list.");
      console.log(`📈 Current status:`);
      console.log(`   - Tested models: ${Object.values(config.providers).reduce((sum, data) => sum + data.models.length, 0)}`);
      console.log(`   - Untested models: ${existingUntestedModels.length}`);
      console.log(`   - Total OpenRouter models: ${openrouterModels.length}`);
      return;
    }
    
    // Group by provider for better display
    const groupedByProvider = newModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, UntestedModel[]>);
    
    // Display results
    for (const [provider, models] of Object.entries(groupedByProvider)) {
      console.log(`📁 ${provider} (${models.length} models):`);
      for (const model of models) {
        console.log(`  - ${model.model} (${model.modelId})`);
      }
      console.log();
    }
    
    // Generate JSON file with new models
    const newModelsJson = {
      generated_at: new Date().toISOString(),
      total_count: newModels.length,
      models: newModels
    };
    writeFileSync("new-models.json", JSON.stringify(newModelsJson, null, 2));
    console.log("📄 Generated new models list: new-models.json");

    // Refresh untested-models.json with all non-tested, non-failed models
    const allUntested: UntestedModel[] = [];
    const failedModelsList = loadFailedModels();
    const failedSet = new Set(failedModelsList.map(m => `${m.provider}/${m.model}`));
    const testedSet = new Set<string>();
    for (const [provider, data] of Object.entries(config.providers)) {
      for (const model of data.models) {
        testedSet.add(`${provider}/${model}`);
      }
    }

    for (const model of openrouterModels) {
      const provider = extractProviderFromModelId(model.id);
      const modelName = model.id.includes("/") ? model.id.split("/")[1] : model.id;
      const modelKey = `${provider}/${modelName}`;

      if (!testedSet.has(modelKey) && !failedSet.has(modelKey)) {
        allUntested.push({
          provider,
          model: modelName,
          modelId: model.id,
          created: model.created
        });
      }
    }

    const untestedJson = {
      generated_at: new Date().toISOString(),
      total_count: allUntested.length,
      models: allUntested
    };
    writeFileSync("untested-models.json", JSON.stringify(untestedJson, null, 2));
    console.log(`📄 Refreshed untested models list: ${allUntested.length} models`);
    
    // Generate a script to run benchmarks for new models
    const benchmarkScript = `#!/bin/bash

# Benchmark script for new OpenRouter models
# Generated on ${new Date().toISOString()}

echo "Starting benchmarks for ${newModels.length} new models..."

# Array of new models to test
models=(
${newModels.map(m => `  "${m.provider}/${m.model}"`).join('\n')}
)

# Function to run benchmark for a single model
run_benchmark() {
  local model=\$1
  echo "\\n=== Benchmarking \$model ==="
  
  # Run the benchmark
  npm run benchmark -- --model="\$model" --debug
  
  # Check if benchmark was successful
  if [ \$? -eq 0 ]; then
    echo "✅ Benchmark completed successfully for \$model"
  else
    echo "❌ Benchmark failed for \$model"
  fi
  
  # Add a small delay between benchmarks
  sleep 2
}

# Run benchmarks for all new models
for model in "\${models[@]}"; do
  run_benchmark "\$model"
done

echo "\\n=== Benchmark completed ==="
echo "Total new models tested: ${newModels.length}"
`;

    writeFileSync("benchmark-new-models.sh", benchmarkScript);
    console.log("📝 Generated benchmark script: benchmark-new-models.sh");
    
    console.log("\n🚀 To run benchmarks for new models:");
    console.log("   chmod +x benchmark-new-models.sh");
    console.log("   ./benchmark-new-models.sh");
    
    // Exit with code 1 to indicate new models were found (useful for CI)
    process.exit(1);
    
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
