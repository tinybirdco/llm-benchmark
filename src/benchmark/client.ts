import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapModel } from "@tinybirdco/ai/ai-sdk";
import { getConfig } from "./config";
import { getDatasources, getEndpointQuestions } from "./resources";
import { getSystemPrompt } from "./prompt";

const router = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function getClient() {
  const { tinybird } = getConfig();

  async function executeSqlQuery(sql: string): Promise<SqlResult> {
    const startTime = Date.now();

    const url = `${tinybird.apiHost}/v0/sql?q=${encodeURIComponent(
      sql
    )} FORMAT JSON`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tinybird.workspaceToken}`,
      },
    });

    const endTime = Date.now();
    const executionTime = (endTime - startTime) / 1000;
    const requestId = response.headers.get("x-request-id") || "unknown";

    if (!response.ok) {
      return {
        success: false,
        data: [],
        executionTime,
        requestId,
        error: (await response.text()).slice(0, 500),
      };
    }

    try {
      const result = await response.json();
      return {
        success: true,
        data: result.data || [],
        meta: result.meta,
        statistics: result.statistics,
        executionTime,
        requestId,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        executionTime,
        requestId,
        error:
          error instanceof Error
            ? error.message?.slice(0, 500)
            : "Unknown error parsing response",
      };
    }
  }

  type RouterResponse = {
    sql: string | null;
    metrics: {
      timeToFirstToken: number;
      totalDuration: number;
      tokens: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    } | null;
  };

  async function callRouter(
    provider: string,
    model: string,
    systemPromptContent: string,
    messages: any[]
  ): Promise<RouterResponse> {
    let timeToFirstToken = 0;
    let totalDuration = 0;
    let sql = "";

    const tokenStats = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    const overallStartTime = Date.now();
    let firstTokenTime = 0;
    let isFirstToken = true;

    const { fullStream, usage } = streamText({
      model: wrapModel(router(`${provider}/${model}`), {
        host: process.env.TINYBIRD_HOST!,
        token: process.env.TINYBIRD_TOKEN!,
      }),
      system: systemPromptContent,
      messages,
    });

    for await (const delta of fullStream) {
      // Record time to first token
      if (isFirstToken) {
        firstTokenTime = Date.now();
        timeToFirstToken = (firstTokenTime - overallStartTime) / 1000; // in seconds
        isFirstToken = false;
      }

      if (delta.type === "text-delta") {
        const { textDelta } = delta;
        if (textDelta) {
          sql += textDelta;
        }
      } else if (delta.type === "error") {
        throw new Error(`Error from model: ${JSON.stringify(delta.error)}`);
      }
    }

    // Calculate total duration
    totalDuration = (Date.now() - overallStartTime) / 1000; // in seconds

    // Get token usage
    try {
      const usageData = await usage;
      if (usageData) {
        tokenStats.promptTokens = usageData.promptTokens || 0;
        tokenStats.completionTokens = usageData.completionTokens || 0;
        tokenStats.totalTokens = usageData.totalTokens || 0;
      }
    } catch (error) {
      console.error("Error getting token usage:", error);
    }

    return {
      sql,
      metrics: {
        timeToFirstToken,
        totalDuration,
        tokens: tokenStats,
      },
    };
  }

  async function generateQuery(
    question: ReturnType<typeof getEndpointQuestions>[number],
    provider: string,
    model: string,
    shouldExecuteSql: boolean = true
  ): Promise<ChatResponse> {
    let response: RouterResponse;

    try {
      response = await callRouter(
        provider,
        model,
        getSystemPrompt(getDatasources()),
        [
          {
            role: "user",
            content: question.question,
          },
        ]
      );
    } catch (error) {
      return {
        sql: null,
        sqlResult: null,
        metrics: null,
        error: error instanceof Error ? error.message : "Unknown error",
        name: question.name,
        question: question,
        model,
        provider,
      };
    }

    const sql =
      (response.sql || "")
        .replaceAll("```sql", "")
        .replaceAll("```", "")
        .replaceAll(";", "") || null;

    const metrics = response.metrics || null;

    let sqlResult: SqlResult | null = null;
    let error: string | null = null;

    if (sql && shouldExecuteSql) {
      try {
        // Make a "warming" request first + small delay to ensure the warming request starts before the actual query
        executeSqlQuery(sql).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 2_500));

        // Execute the actual query
        sqlResult = await executeSqlQuery(sql);
      } catch (e) {
        error = e instanceof Error ? e.message : "Unknown error";
      }
    }

    return {
      sql,
      sqlResult: {
        ...sqlResult,
        data:
          JSON.stringify(sqlResult?.data)?.length > 1000000
            ? null
            : sqlResult?.data,
        length: JSON.stringify(sqlResult?.data)?.length,
      },
      name: question.name,
      question: question,
      model,
      provider,
      metrics,
      error,
    };
  }

  return { generateQuery, executeSqlQuery };
}
