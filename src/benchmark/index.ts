import { writeFileSync } from "fs";
import { getClient } from "./client";
import { getConfig } from "./config";
import { getEndpointQuestions } from "./resources";

const MAX_RETRIES = 2;

async function main() {
  await runHumanQueries();
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

  const allResults: ChatResponse[] = [];

  for (const provider in providers) {
    const models = providers[provider as keyof typeof providers].models;

    let index = 0;
    for (const model of models) {
      console.log(
        `Benchmarking ${provider}/${model} (${index + 1}/${models.length})`
      );

      const results = await runModelBenchmark(provider, model);

      allResults.push(...results);
      index++;
    }
  }

  console.log("Final results =>");
  console.log(allResults);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `benchmark/results-${timestamp}.json`;
  const staticFileName = `benchmark/results.json`;

  writeFileSync(fileName, JSON.stringify(allResults, null, 2));
  writeFileSync(staticFileName, JSON.stringify(allResults, null, 2));
}

async function runModelBenchmark(provider: string, model: string) {
  const client = getClient();

  const questions = getEndpointQuestions();
  const results = [];

  async function generateQueryWithRetry(
    question: ReturnType<typeof getEndpointQuestions>[number],
    retryCount = 0,
    previousAttempts: ChatResponse[] = []
  ) {
    const result = await client.generateQuery(question, provider, model, true);

    const currentAttempts = [...previousAttempts, result];

    if (result.error && retryCount < MAX_RETRIES) {
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

  for (const question of questions) {
    const result = await generateQueryWithRetry(question);
    results.push(result);
  }

  return results;
}

main();
