export interface ChatResponse {
  sql: string | null;
  sqlResult: any | null;
  metrics: any | null;
  error: string | null;
  name: string;
  question: {
    name: string;
    question: string;
  };
  model: string;
  provider: string;
  attempts?: ChatResponse[];
}

export interface SqlResult {
  success: boolean;
  data: any[];
  meta?: any;
  statistics?: {
    elapsed?: number;
  };
  executionTime: number;
  requestId: string;
  error?: string;
}
