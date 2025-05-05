import { writeFileSync, readFileSync, existsSync } from "fs";
import { getClient } from "./client";
import { getConfig } from "./config";
import { getEndpointQuestions } from "./resources";
import { ChatResponse } from "./types";

const MAX_RETRIES = 2;
const RESULTS_FILE = "benchmark/results.json";

function readExistingResults(): ChatResponse[] {
  if (!existsSync(RESULTS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(RESULTS_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading results file:", error);
    return [];
  }
}

function writeResults(results: ChatResponse[]) {
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function getCompletedQuestionsForModel(
  existingResults: ChatResponse[],
  provider: string,
  model: string
): Set<string> {
  return new Set(
    existingResults
      .filter((r) => r.provider === provider && r.model === model)
      .map((r) => r.question.name)
  );
}

async function main() {
  // await runHumanQueries();
  await runBenchmark();
}

async function runHumanQueries() {
  const client = getClient();
  const endpoints = getEndpointQuestions();

  const results = [];

  for (const endpoint of endpoints) {
    console.log(`Running ${endpoint.name}`);

    const sql = endpoint.content
      .split("SQL >")[1]
      .split("TYPE endpoint")[0]
      .trim();

    client.executeSqlQuery(sql);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await client.executeSqlQuery(sql);

    results.push({
      name: endpoint.name,
      question: {
        name: endpoint.name,
        content: endpoint.question,
      },
      sql,
      sqlResult: result,
      model: "human",
      provider: "human",
      error: null,
      attempts: [],
    });
  }

  writeFileSync(
    "benchmark/results-human.json",
    JSON.stringify(results, null, 2)
  );
}

async function runBenchmark() {
  const { providers } = getConfig();
  let existingResults = readExistingResults();

  for (const provider in providers) {
    const models = providers[provider as keyof typeof providers].models;

    let index = 0;
    for (const model of models) {
      console.log(
        `Benchmarking ${provider}/${model} (${index + 1}/${models.length})`
      );

      const completedQuestions = getCompletedQuestionsForModel(
        existingResults,
        provider,
        model
      );
      const results = await runModelBenchmark(
        provider,
        model,
        completedQuestions
      );

      // Update results file after each model run
      // Remove only the results for this specific model/provider combination
      existingResults = existingResults.filter(
        (r) => !(r.provider === provider && r.model === model)
      );
      // Add the new results
      existingResults.push(...results);
      // Write the updated results
      writeResults(existingResults);

      index++;
    }
  }
}

async function runModelBenchmark(
  provider: string,
  model: string,
  completedQuestions: Set<string>
) {
  const client = getClient();
  const questions = getEndpointQuestions();
  const results: ChatResponse[] = [];

  async function generateQueryWithRetry(
    question: ReturnType<typeof getEndpointQuestions>[number],
    retryCount = 0,
    previousAttempts: ChatResponse[] = []
  ) {
    const result = await client.generateQuery(question, provider, model, true);

    const currentAttempts = [...previousAttempts, result];

    if (
      (result.error ||
        result.sqlResult?.success === false ||
        !!result.sqlResult?.error) &&
      retryCount < MAX_RETRIES
    ) {
      const errorFeedback = `I previously asked: "${question.question}"\n\nYou generated this SQL query:\n\`\`\`sql\n${result.sql}\n\`\`\`\n\nBut it resulted in this error:\n\`\`\`\n${result.error}\n\`\`\`\n\nPlease fix the SQL query to correctly answer my original question. Make sure the SQL is valid for Tinybird/ClickHouse.`;

      return generateQueryWithRetry(
        {
          ...question,
          question: errorFeedback,
        },
        retryCount + 1,
        currentAttempts
      );
    }

    return {
      ...result,
      question,
      model,
      provider,
      attempts: currentAttempts,
    };
  }

  for (const question of questions.slice(0, 10)) {
    // Skip already completed questions
    if (completedQuestions.has(question.name)) {
      console.log(`Skipping already completed question: ${question.name}`);
      continue;
    }

    console.log(`Running question: ${question.name}`);
    const result = await generateQueryWithRetry(question);
    results.push(result);
  }

  return results;
}

main();
