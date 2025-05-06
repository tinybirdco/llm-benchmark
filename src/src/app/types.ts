export type SqlResult = {
  success: boolean;
  data: Record<string, unknown>[];
  executionTime?: number;
  error?: string;
  statistics?: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
};

export type ModelResult = {
  sql: string;
  sqlResult: SqlResult | null;
  metrics?: {
    timeToFirstToken: number;
    totalDuration: number;
    tokens: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  name: string;
  error: null | string;
  question: {
    name: string;
    content: string;
  };
  model: string;
  provider: string;
  attempts: ModelResult[];
  rank?: number;
};

export type BenchmarkResults = ModelResult[]; 