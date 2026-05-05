import { readFileSync, writeFileSync, existsSync } from "fs";
import { fetchOpenRouterModels, extractProviderFromModelId } from "./fetch-openrouter-models";

interface ModelMetadata {
  created: number;
  name: string;
}

type ModelMetadataMap = Record<string, ModelMetadata>;

function loadExistingMetadata(): ModelMetadataMap {
  const path = "model-metadata.json";
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf-8"));
  }
  return {};
}

function collectAllKnownModels(): string[] {
  const models: string[] = [];

  const config = JSON.parse(readFileSync("benchmark-config.json", "utf-8"));
  for (const [provider, data] of Object.entries(config.providers) as [string, { models: string[] }][]) {
    for (const model of data.models) {
      models.push(`${provider}/${model}`);
    }
  }

  if (existsSync("failed-models.json")) {
    const failed = JSON.parse(readFileSync("failed-models.json", "utf-8"));
    for (const m of failed.models || []) {
      models.push(`${m.provider}/${m.model}`);
    }
  }

  return [...new Set(models)];
}

async function main() {
  console.log("Backfilling model metadata from OpenRouter API...\n");

  const openrouterModels = await fetchOpenRouterModels();
  const knownModels = collectAllKnownModels();
  const existingMetadata = loadExistingMetadata();

  const orIndex = new Map<string, { created: number; name: string }>();
  for (const model of openrouterModels) {
    const provider = extractProviderFromModelId(model.id);
    const modelName = model.id.includes("/") ? model.id.split("/")[1] : model.id;
    orIndex.set(`${provider}/${modelName}`, {
      created: model.created,
      name: model.name,
    });
  }

  const metadata: ModelMetadataMap = { ...existingMetadata };
  let matched = 0;
  let missing = 0;

  for (const modelKey of knownModels) {
    const orData = orIndex.get(modelKey);
    if (orData) {
      metadata[modelKey] = { created: orData.created, name: orData.name };
      matched++;
    } else if (!metadata[modelKey]) {
      missing++;
      console.log(`  Missing from OpenRouter: ${modelKey}`);
    }
  }

  writeFileSync("model-metadata.json", JSON.stringify(metadata, null, 2) + "\n");

  console.log(`\nDone. Matched ${matched} models, ${missing} not found on OpenRouter.`);
  console.log(`Total entries in model-metadata.json: ${Object.keys(metadata).length}`);
}

if (require.main === module) {
  main();
}
