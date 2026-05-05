import { readFileSync, writeFileSync, existsSync } from "fs";

interface FailedModel {
  provider: string;
  model: string;
  modelId: string;
  reason: string;
  failed_at: string;
  attempt_count: number;
}

interface FailedModelsData {
  generated_at: string;
  total_count: number;
  models: FailedModel[];
}

function loadFailedModels(): FailedModelsData {
  try {
    const failedPath = "failed-models.json";
    if (!existsSync(failedPath)) {
      return {
        generated_at: new Date().toISOString(),
        total_count: 0,
        models: []
      };
    }
    return JSON.parse(readFileSync(failedPath, "utf-8"));
  } catch (error) {
    console.error("Error reading failed-models.json:", error);
    return {
      generated_at: new Date().toISOString(),
      total_count: 0,
      models: []
    };
  }
}

function addFailedModel(provider: string, model: string, modelId: string, reason: string): void {
  console.log(`Adding failed model: ${provider}/${model} (${reason})`);

  const failedData = loadFailedModels();

  const existingIndex = failedData.models.findIndex(
    m => m.provider === provider && m.model === model
  );

  if (existingIndex >= 0) {
    failedData.models[existingIndex].attempt_count += 1;
    failedData.models[existingIndex].failed_at = new Date().toISOString();
    failedData.models[existingIndex].reason = reason;
  } else {
    failedData.models.push({
      provider,
      model,
      modelId,
      reason,
      failed_at: new Date().toISOString(),
      attempt_count: 1
    });
  }

  failedData.total_count = failedData.models.length;
  failedData.generated_at = new Date().toISOString();

  writeFileSync("failed-models.json", JSON.stringify(failedData, null, 2));
  console.log(`Added to failed-models.json: ${provider}/${model}`);
}

function removeFromFailedModels(provider: string, model: string): void {
  const failedData = loadFailedModels();

  const filteredModels = failedData.models.filter(
    m => !(m.provider === provider && m.model === model)
  );

  if (filteredModels.length !== failedData.models.length) {
    failedData.models = filteredModels;
    failedData.total_count = filteredModels.length;
    failedData.generated_at = new Date().toISOString();

    writeFileSync("failed-models.json", JSON.stringify(failedData, null, 2));
    console.log(`Removed from failed-models.json: ${provider}/${model}`);
  }
}

function listFailedModels(): void {
  const failedData = loadFailedModels();

  console.log(`\n📊 Failed Models Summary:`);
  console.log(`Total failed models: ${failedData.total_count}`);

  if (failedData.models.length === 0) {
    console.log("No failed models found.");
    return;
  }

  const groupedByProvider = failedData.models.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, FailedModel[]>);

  for (const [provider, models] of Object.entries(groupedByProvider)) {
    console.log(`\n📁 ${provider} (${models.length} failed models):`);
    for (const model of models) {
      console.log(`  - ${model.model} (attempts: ${model.attempt_count}, reason: ${model.reason})`);
    }
  }
}

function clearFailedModels(): void {
  const emptyData: FailedModelsData = {
    generated_at: new Date().toISOString(),
    total_count: 0,
    models: []
  };

  writeFileSync("failed-models.json", JSON.stringify(emptyData, null, 2));
  console.log("Cleared all failed models from failed-models.json");
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "add":
      if (args.length < 5) {
        console.error("Usage: npm run manage-failed-models add <provider> <model> <modelId> <reason>");
        process.exit(1);
      }
      addFailedModel(args[1], args[2], args[3], args[4]);
      break;

    case "remove":
      if (args.length < 3) {
        console.error("Usage: npm run manage-failed-models remove <provider> <model>");
        process.exit(1);
      }
      removeFromFailedModels(args[1], args[2]);
      break;

    case "list":
      listFailedModels();
      break;

    case "clear":
      clearFailedModels();
      break;

    default:
      console.log(`
Failed Models Management Tool

Usage:
  npm run manage-failed-models <command> [args]

Commands:
  add <provider> <model> <modelId> <reason>  - Add a failed model
  remove <provider> <model>                  - Remove a failed model
  list                                       - List all failed models
  clear                                      - Clear all failed models

Examples:
  npm run manage-failed-models add openrouter sonoma-dusk-alpha openrouter/sonoma-dusk-alpha "API error"
  npm run manage-failed-models remove openrouter sonoma-dusk-alpha
  npm run manage-failed-models list
  npm run manage-failed-models clear
      `);
  }
}

if (require.main === module) {
  main();
}

export { addFailedModel, removeFromFailedModels, loadFailedModels };
