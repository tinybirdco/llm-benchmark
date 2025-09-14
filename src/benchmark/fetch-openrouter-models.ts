import { readFileSync, writeFileSync } from "fs";

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number;
    is_moderated: boolean;
  };
  per_request_limits: {
    prompt_tokens: string;
    completion_tokens: string;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

interface BenchmarkConfig {
  providers: {
    [provider: string]: {
      models: string[];
    };
  };
}

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    console.log("Fetching models from OpenRouter API...");
    const response = await fetch("https://openrouter.ai/api/v1/models");
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: OpenRouterResponse = await response.json();
    console.log(`Fetched ${data.data.length} models from OpenRouter`);
    return data.data;
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    throw error;
  }
}

function loadBenchmarkConfig(): BenchmarkConfig {
  try {
    const configPath = "benchmark-config.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    return config;
  } catch (error) {
    console.error("Error reading benchmark-config.json:", error);
    throw error;
  }
}

function extractProviderFromModelId(modelId: string): string {
  // OpenRouter model IDs are typically in format "provider/model-name"
  // or sometimes just "model-name" for some providers
  const parts = modelId.split("/");
  if (parts.length === 2) {
    return parts[0];
  }
  
  // For models without explicit provider, try to infer from common patterns
  const lowerModelId = modelId.toLowerCase();
  
  if (lowerModelId.includes("gpt") || lowerModelId.includes("o1") || lowerModelId.includes("o3")) {
    return "openai";
  } else if (lowerModelId.includes("claude")) {
    return "anthropic";
  } else if (lowerModelId.includes("gemini")) {
    return "google";
  } else if (lowerModelId.includes("llama")) {
    return "meta-llama";
  } else if (lowerModelId.includes("mistral") || lowerModelId.includes("codestral") || lowerModelId.includes("devstral")) {
    return "mistralai";
  } else if (lowerModelId.includes("deepseek")) {
    return "deepseek";
  } else if (lowerModelId.includes("qwen")) {
    return "qwen";
  } else if (lowerModelId.includes("grok")) {
    return "x-ai";
  } else if (lowerModelId.includes("kimi")) {
    return "moonshotai";
  } else if (lowerModelId.includes("nemotron")) {
    return "nvidia";
  }
  
  // Default to using the first part of the model ID as provider
  return parts[0] || "unknown";
}

function findUntestedModels(openrouterModels: OpenRouterModel[], config: BenchmarkConfig): Array<{provider: string, model: string, modelId: string}> {
  const untestedModels: Array<{provider: string, model: string, modelId: string}> = [];
  
  for (const model of openrouterModels) {
    const provider = extractProviderFromModelId(model.id);
    const modelName = model.id.includes("/") ? model.id.split("/")[1] : model.id;
    
    // Check if this provider exists in config
    if (!config.providers[provider]) {
      // Provider doesn't exist, so this model is untested
      untestedModels.push({
        provider,
        model: modelName,
        modelId: model.id
      });
    } else {
      // Provider exists, check if this specific model is in the list
      if (!config.providers[provider].models.includes(modelName)) {
        untestedModels.push({
          provider,
          model: modelName,
          modelId: model.id
        });
      }
    }
  }
  
  return untestedModels;
}

function findNewModels(openrouterModels: OpenRouterModel[], config: BenchmarkConfig, existingUntestedModels: Array<{provider: string, model: string, modelId: string}>): Array<{provider: string, model: string, modelId: string}> {
  const newModels: Array<{provider: string, model: string, modelId: string}> = [];
  
  // Create sets for faster lookup
  const testedModels = new Set<string>();
  const untestedModels = new Set<string>();
  
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
  
  // Check each OpenRouter model
  for (const model of openrouterModels) {
    const provider = extractProviderFromModelId(model.id);
    const modelName = model.id.includes("/") ? model.id.split("/")[1] : model.id;
    const modelKey = `${provider}/${modelName}`;
    
    // If not tested and not in untested list, it's new
    if (!testedModels.has(modelKey) && !untestedModels.has(modelKey)) {
      newModels.push({
        provider,
        model: modelName,
        modelId: model.id
      });
    }
  }
  
  return newModels;
}

function generateBatchScript(untestedModels: Array<{provider: string, model: string, modelId: string}>): string {
  const script = `#!/bin/bash

# Batch benchmark script for untested OpenRouter models
# Generated on ${new Date().toISOString()}

echo "Starting batch benchmark for ${untestedModels.length} untested models..."

# Array of models to test
models=(
${untestedModels.map(m => `  "${m.provider}/${m.model}"`).join('\n')}
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

# Run benchmarks for all models
for model in "\${models[@]}"; do
  run_benchmark "\$model"
done

echo "\\n=== Batch benchmark completed ==="
echo "Total models tested: ${untestedModels.length}"
`;

  return script;
}

async function main() {
  try {
    console.log("🔍 Finding untested OpenRouter models...\n");
    
    // Fetch models from OpenRouter
    const openrouterModels = await fetchOpenRouterModels();
    
    // Load current benchmark config
    const config = loadBenchmarkConfig();
    
    // Find untested models
    const untestedModels = findUntestedModels(openrouterModels, config);
    
    console.log(`📊 Found ${untestedModels.length} untested models:\n`);
    
    // Group by provider for better display
    const groupedByProvider = untestedModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, Array<{provider: string, model: string, modelId: string}>>);
    
    // Display results
    for (const [provider, models] of Object.entries(groupedByProvider)) {
      console.log(`📁 ${provider} (${models.length} models):`);
      for (const model of models) {
        console.log(`  - ${model.model} (${model.modelId})`);
      }
      console.log();
    }
    
    // Generate batch script
    const batchScript = generateBatchScript(untestedModels);
    writeFileSync("benchmark-untested-models.sh", batchScript);
    console.log("📝 Generated batch script: benchmark-untested-models.sh");
    
    // Generate a JSON file with untested models for programmatic use
    const untestedModelsJson = {
      generated_at: new Date().toISOString(),
      total_count: untestedModels.length,
      models: untestedModels
    };
    writeFileSync("untested-models.json", JSON.stringify(untestedModelsJson, null, 2));
    console.log("📄 Generated untested models list: untested-models.json");
    
    console.log("\n🚀 To run benchmarks for all untested models:");
    console.log("   chmod +x benchmark-untested-models.sh");
    console.log("   ./benchmark-untested-models.sh");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { fetchOpenRouterModels, findUntestedModels, extractProviderFromModelId };
