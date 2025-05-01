import { getConfig } from "./config";
import { getDatasources, getEndpointQuestions } from "./resources";

function getExplorationObject(): ExplorationObject {
  const { tinybird } = getConfig();

  return {
    nodes: [],
    id: tinybird.explorationId,
    name: tinybird.explorationName,
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    shared_with: [],
    shared_by: null,
    user_id: tinybird.userId,
  };
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

  async function generateQuery(
    question: ReturnType<typeof getEndpointQuestions>[number],
    provider: string,
    model: string,
    shouldExecuteSql: boolean = true
  ): Promise<ChatResponse> {
    const datasources = getDatasources();

    const explorationId = "default";
    const messageId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const payload: ChatPayload = {
      id: explorationId,
      message: {
        id: messageId,
        createdAt: timestamp,
        role: "user",
        content: question.question,
        parts: [
          {
            type: "text",
            text: question.question,
          },
        ],
      },
      dataFiles: datasources,
      modelName: model,
      provider,
      userToken: tinybird.userToken,
      apiHost: tinybird.apiHost,
      workspaceToken: tinybird.workspaceToken,
      workspaceId: tinybird.workspaceId,
      exploration: getExplorationObject(),
    };

    const response = await fetch(tinybird.chatApiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();

      return {
        sql: null,
        sqlResult: null,
        metrics: null,
        error: error.error,
        name: question.name,
        question: question,
        model,
        provider,
      };
    }

    const jsonResponse = await response.json();

    let sql: string | null = jsonResponse.sql || null;
    let sqlResult: SqlResult | null = null;
    let metrics = jsonResponse.metrics || null;
    let error: string | null = null;

    if (jsonResponse.sql && shouldExecuteSql) {
      try {
        // Make a "warming" request first + small delay to ensure the warming request starts before the actual query
        executeSqlQuery(jsonResponse.sql).catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 2_500));

        // Execute the actual query
        sqlResult = await executeSqlQuery(jsonResponse.sql);
      } catch (error) {
        error = error instanceof Error ? error.message : "Unknown error";
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
        length: JSON.stringify(sqlResult?.data).length,
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
