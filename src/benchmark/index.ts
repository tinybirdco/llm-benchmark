import { writeFileSync, readFileSync, existsSync } from "fs";
import { getClient } from "./client";
import { getConfig } from "./config";
import { getEndpointQuestion, getEndpointQuestions } from "./resources";
import { ChatResponse } from "./types";
import { compareResults } from "./result-validator";

const MAX_RETRIES = 2;
const RESULTS_FILE = "benchmark/results.json";
const HUMAN_RESULTS_FILE = "benchmark/results-human.json";

function readHumanResults(): ChatResponse[] {
  if (!existsSync(HUMAN_RESULTS_FILE)) {
    console.error("Human results file not found");
    return [];
  }
  try {
    return JSON.parse(readFileSync(HUMAN_RESULTS_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading human results file:", error);
    return [];
  }
}

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

function validateResults(results: ChatResponse[]): Record<string, any> {
  const humanResults = readHumanResults();
  if (humanResults.length === 0) {
    console.error("No human results available for validation");
    return {};
  }

  const humanResultsByQuestion = new Map<string, ChatResponse>();
  for (const result of humanResults) {
    humanResultsByQuestion.set(result.question.name, result);
  }

  const validation: Record<string, any> = {};

  for (const result of results) {
    if (!result.question || !result.sqlResult || result.error) {
      continue;
    }

    const questionName = result.question.name;
    const humanResult = humanResultsByQuestion.get(questionName);

    if (!humanResult || !humanResult.sqlResult) {
      continue;
    }

    if (!validation[questionName]) {
      validation[questionName] = {
        models: {},
        humanResults: humanResult.sqlResult,
      };
    }

    const modelKey = `${result.provider}/${result.model}`;
    const comparisonResult = compareResults(humanResult.sqlResult, result.sqlResult);
    
    validation[questionName].models[modelKey] = {
      ...comparisonResult,
      sql: result.sql
    };
  }

  const summary = calculateValidationSummary(validation);
  validation._summary = summary;

  writeFileSync(
    "benchmark/validation-results.json",
    JSON.stringify(validation, null, 2)
  );

  return validation;
}

function calculateValidationSummary(validation: Record<string, any>): any {
  const summary = {
    totalQuestions: 0,
    modelStats: {} as Record<string, {
      totalMatches: number,
      exactMatches: number,
      numericMatches: number,
      avgExactDistance: number,
      avgNumericDistance: number,
      avgFScore: number
    }>
  };
  
  const questions = Object.keys(validation).filter(key => key !== '_summary');
  summary.totalQuestions = questions.length;
  
  for (const questionName of questions) {
    const questionData = validation[questionName];
    const models = questionData.models;
    
    for (const modelKey of Object.keys(models)) {
      if (!summary.modelStats[modelKey]) {
        summary.modelStats[modelKey] = {
          totalMatches: 0,
          exactMatches: 0,
          numericMatches: 0,
          avgExactDistance: 0,
          avgNumericDistance: 0,
          avgFScore: 0
        };
      }
      
      const modelResult = models[modelKey];
      const stats = summary.modelStats[modelKey];
      
      if (modelResult.matches) {
        stats.totalMatches++;
      }
      
      if (modelResult.exactMatches) {
        stats.exactMatches++;
      }
      
      if (modelResult.numericMatches) {
        stats.numericMatches++;
      }
      
      if (modelResult.distance) {
        stats.avgExactDistance += modelResult.distance.exact || 0;
        stats.avgNumericDistance += modelResult.distance.numeric || 0;
        stats.avgFScore += modelResult.distance.fScore || 0;
      }
    }
  }
  
  for (const modelKey of Object.keys(summary.modelStats)) {
    const stats = summary.modelStats[modelKey];
    const count = summary.totalQuestions;
    
    if (count > 0) {
      stats.avgExactDistance = stats.avgExactDistance / count;
      stats.avgNumericDistance = stats.avgNumericDistance / count;
      stats.avgFScore = stats.avgFScore / count;
    }
  }
  
  return summary;
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
  await runHumanQueries("pipe_58.pipe");
  await runBenchmark();
  
  const results = readExistingResults();
  console.log("Validating results against human baseline...");
  const validation = validateResults(results);
  console.log("Validation complete. Results saved to benchmark/validation-results.json");
}

async function runHumanQueries(filter: string) {
  const client = getClient();
  const endpoints = getEndpointQuestions();

  const results = [];

  for (const endpoint of endpoints) {
    if (filter && endpoint.name !== filter) {
      continue;
    }

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

  // FIXME: Only run for Anthropic and some OAI for now
  for (const provider of ["anthropic", "google"]) {
    const models = providers[provider as keyof typeof providers].models;

    let index = 0;
    // FIXME: Only run for Anthropic and some OAI for now
    for (const model of models.slice(0, 2)) {
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

      existingResults = existingResults.filter(
        (r) => !(r.provider === provider && r.model === model)
      );
      existingResults.push(...results);
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
  const question = getEndpointQuestion("pipe_58.pipe");
  const questions = [question];
  
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

  // Filter out completed questions and take first 10
  const pendingQuestions = questions
    .filter(q => !completedQuestions.has(q.name))
    .slice(0, 10);

  // Process questions in batches of 5
  for (let i = 0; i < pendingQuestions.length; i += 5) {
    const batch = pendingQuestions.slice(i, i + 5);
    console.log(`Processing batch ${Math.floor(i/5) + 1} with ${batch.length} questions`);
    
    const batchResults = await Promise.all(
      batch.map(question => {
        console.log(`Running question: ${question.name}`);
        return generateQueryWithRetry(question);
      })
    );
    
    results.push(...batchResults);
  }

  return results;
}

main();
