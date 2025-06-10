import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getConfig } from "./config";
import { getDatasources, getEndpointQuestions } from "./resources";
import { getSystemPrompt } from "./prompt";
import { ChatResponse, SqlResult } from "./types";

const router = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Debug logging function that only logs when LLM_DEBUG=1
function debugLog(message: string, data?: Record<string, unknown>): void {
  if (process.env.LLM_DEBUG === '1') {
    console.log(`[DEBUG] ${message}`);
    if (data !== undefined) {
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(data);
      }
    }
    console.log('-----------------------------------');
  }
}

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
      const errorText = await response.text();
      debugLog("SQL Execution Error", {
        sql,
        error: errorText.slice(0, 500),
        status: response.status,
        requestId
      });
      
      return {
        success: false,
        data: [],
        executionTime,
        requestId,
        error: errorText.slice(0, 500),
      };
    }

    try {
      const result = await response.json();
      
      debugLog("SQL Execution Success", {
        sql,
        resultRowCount: result.data?.length || 0,
        executionTime,
        requestId,
        sampleData: result.data?.slice(0, 3) || []
      });
      
      return {
        success: true,
        data: result.data || [],
        meta: result.meta,
        statistics: result.statistics,
        executionTime,
        requestId,
      };
    } catch (error) {
      debugLog("SQL Result Parsing Error", {
        sql,
        error: error instanceof Error ? error.message?.slice(0, 500) : "Unknown error parsing response"
      });
      
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    debugLog("Calling LLM", {
      provider,
      model,
      messages: messages.map(m => ({
        role: m.role,
        contentPreview: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
      }))
    });

    const overallStartTime = Date.now();
    let firstTokenTime = 0;
    let isFirstToken = true;

    const { fullStream, usage } = streamText({
      model: router(`${provider}/${model}`),
      system: systemPromptContent,
      messages,
    });

    for await (const delta of fullStream) {
      // Record time to first token
      if (isFirstToken) {
        firstTokenTime = Date.now();
        timeToFirstToken = (firstTokenTime - overallStartTime) / 1000; // in seconds
        isFirstToken = false;
        
        debugLog("Received first token", {
          provider,
          model,
          timeToFirstToken
        });
      }

      if (delta.type === "text-delta") {
        const { textDelta } = delta;
        if (textDelta) {
          sql += textDelta;
        }
      } else if (delta.type === "error") {
        const errorMsg = `Error from model: ${JSON.stringify(delta.error)}`;
        debugLog("LLM Error", {
          provider,
          model,
          error: delta.error
        });
        throw new Error(errorMsg);
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
      
      debugLog("LLM Response Complete", {
        provider,
        model,
        totalDuration,
        tokenStats,
        sqlPreview: sql.substring(0, 200) + (sql.length > 200 ? '...' : '')
      });
      
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
      debugLog("Query Generation Error", {
        provider,
        model,
        question: question.name,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      
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

    debugLog("Formatted SQL", {
      original: response.sql?.substring(0, 100) + (response.sql && response.sql.length > 100 ? '...' : ''),
      formatted: sql?.substring(0, 100) + (sql && sql.length > 100 ? '...' : ''),
      query: question.name
    });

    const metrics = response.metrics || null;

    let sqlResult: SqlResult | null = null;
    let error: string | null = null;

    if (sql && shouldExecuteSql) {
      try {
        debugLog("Warming SQL query", {
          query: question.name,
          sql
        });
        
        // Make a "warming" request first + small delay to ensure the warming request starts before the actual query
        executeSqlQuery(sql).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 2_500));

        debugLog("Executing actual SQL query", {
          query: question.name,
          sql
        });
        
        // Execute the actual query
        sqlResult = await executeSqlQuery(sql);
      } catch (e) {
        error = e instanceof Error ? e.message : "Unknown error";
        
        debugLog("SQL Execution Catch Block Error", {
          query: question.name,
          sql,
          error
        });
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
