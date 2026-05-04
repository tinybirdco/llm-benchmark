import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

interface BenchmarkConfig {
  providers: {
    [provider: string]: {
      models: string[];
    };
  };
}

function exec(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }).trim();
}

function getFileFromBranch(branch: string, filePath: string): string | null {
  try {
    return exec(`git show "origin/${branch}:${filePath}"`);
  } catch {
    return null;
  }
}

async function main() {
  console.log("Merging results from open benchmark PRs...\n");

  // Get all open benchmark PRs
  const prsJson = exec(
    'gh pr list --state open --search "Add benchmark results for" --limit 300 --json number,title,headRefName'
  );
  const prs: { number: number; title: string; headRefName: string }[] = JSON.parse(prsJson);

  console.log(`Found ${prs.length} open benchmark PRs\n`);
  if (prs.length === 0) {
    console.log("Nothing to merge.");
    return;
  }

  // Load current main state
  const mainResults: any[] = JSON.parse(readFileSync("benchmark/results.json", "utf-8"));
  const mainConfig: BenchmarkConfig = JSON.parse(readFileSync("benchmark-config.json", "utf-8"));
  let mainValidation: any = {};
  if (existsSync("benchmark/validation-results.json")) {
    mainValidation = JSON.parse(readFileSync("benchmark/validation-results.json", "utf-8"));
  }

  const existingModels = new Set(mainResults.map((r) => `${r.provider}/${r.model}`));

  // Fetch all branches
  console.log("Fetching all PR branches...");
  exec("git fetch origin --prune");

  let merged = 0;
  let skipped = 0;
  let failed = 0;

  for (const pr of prs) {
    const branch = pr.headRefName;
    const modelMatch = pr.title.match(/Add benchmark results for (.+)/);
    if (!modelMatch) {
      console.log(`  Skipping PR #${pr.number}: unexpected title "${pr.title}"`);
      skipped++;
      continue;
    }
    const modelId = modelMatch[1];
    const [provider, modelName] = modelId.split("/");

    if (!provider || !modelName) {
      console.log(`  Skipping PR #${pr.number}: can't parse model ID "${modelId}"`);
      skipped++;
      continue;
    }

    // Check if already merged
    if (existingModels.has(`${provider}/${modelName}`)) {
      console.log(`  Skipping ${modelId}: already in results`);
      skipped++;
      continue;
    }

    // Get results from branch
    const branchResultsStr = getFileFromBranch(branch, "src/benchmark/results.json");
    if (!branchResultsStr) {
      console.log(`  Failed to read results from branch ${branch} (PR #${pr.number})`);
      failed++;
      continue;
    }

    const branchResults: any[] = JSON.parse(branchResultsStr);
    const newEntries = branchResults.filter(
      (r) => r.provider === provider && r.model === modelName
    );

    if (newEntries.length === 0) {
      console.log(`  No entries found for ${modelId} in branch ${branch}`);
      failed++;
      continue;
    }

    // Add results
    mainResults.push(...newEntries);
    existingModels.add(`${provider}/${modelName}`);

    // Add to config
    if (!mainConfig.providers[provider]) {
      mainConfig.providers[provider] = { models: [] };
    }
    if (!mainConfig.providers[provider].models.includes(modelName)) {
      mainConfig.providers[provider].models.push(modelName);
    }

    // Try to get validation results
    const branchValidationStr = getFileFromBranch(branch, "src/benchmark/validation-results.json");
    if (branchValidationStr) {
      try {
        const branchValidation = JSON.parse(branchValidationStr);
        if (branchValidation[modelId]) {
          mainValidation[modelId] = branchValidation[modelId];
        } else if (branchValidation[modelName]) {
          mainValidation[modelName] = branchValidation[modelName];
        }
      } catch {}
    }

    console.log(`  Merged ${modelId}: ${newEntries.length} entries (PR #${pr.number})`);
    merged++;
  }

  // Write merged results
  writeFileSync("benchmark/results.json", JSON.stringify(mainResults, null, 2) + "\n");
  writeFileSync("benchmark-config.json", JSON.stringify(mainConfig, null, 2) + "\n");
  if (Object.keys(mainValidation).length > 0) {
    writeFileSync("benchmark/validation-results.json", JSON.stringify(mainValidation, null, 2) + "\n");
  }

  console.log(`\nDone. Merged: ${merged}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Total results entries: ${mainResults.length}`);
  console.log(`Total models in config: ${Object.values(mainConfig.providers).reduce((sum, d) => sum + d.models.length, 0)}`);

  if (merged > 0) {
    console.log("\nNext steps:");
    console.log("  1. Review the changes: git diff");
    console.log("  2. Commit: git add -A && git commit -m 'Merge benchmark results from open PRs'");
    console.log("  3. Push: git push origin main");
    console.log(`  4. Close PRs: gh pr list --state open --search 'Add benchmark results' --json number --jq '.[].number' | xargs -I {} gh pr close {} --comment 'Results merged to main via batch script.'`);
  }
}

if (require.main === module) {
  main();
}
