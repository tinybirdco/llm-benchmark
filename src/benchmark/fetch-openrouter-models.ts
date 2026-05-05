import { readFileSync } from "fs";

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
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
    const textModels = data.data.filter(m => isTextOutputModel(m.architecture?.modality || ''));
    console.log(`Fetched ${data.data.length} models from OpenRouter (${textModels.length} text-output models)`);
    return textModels;
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
  const parts = modelId.split("/");
  if (parts.length === 2) {
    return parts[0];
  }

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

  return parts[0] || "unknown";
}

function findUntestedModels(openrouterModels: OpenRouterModel[], config: BenchmarkConfig): Array<{provider: string, model: string, modelId: string}> {
  const untestedModels: Array<{provider: string, model: string, modelId: string}> = [];

  for (const model of openrouterModels) {
    const provider = extractProviderFromModelId(model.id);
    const modelName = model.id.includes("/") ? model.id.split("/")[1] : model.id;

    if (!config.providers[provider]) {
      untestedModels.push({
        provider,
        model: modelName,
        modelId: model.id
      });
    } else {
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

async function main() {
  try {
    console.log("🔍 Finding untested OpenRouter models...\n");

    const openrouterModels = await fetchOpenRouterModels();
    const config = loadBenchmarkConfig();
    const untestedModels = findUntestedModels(openrouterModels, config);

    console.log(`📊 Found ${untestedModels.length} untested models:\n`);

    const groupedByProvider = untestedModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, Array<{provider: string, model: string, modelId: string}>>);

    for (const [provider, models] of Object.entries(groupedByProvider)) {
      console.log(`📁 ${provider} (${models.length} models):`);
      for (const model of models) {
        console.log(`  - ${model.model} (${model.modelId})`);
      }
      console.log();
    }

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export function isTextOutputModel(modality: string): boolean {
  const outputPart = (modality.split('->')[1] || '').trim();
  return outputPart === 'text';
}

export { fetchOpenRouterModels, findUntestedModels, extractProviderFromModelId };
