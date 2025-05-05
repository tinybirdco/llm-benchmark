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

export interface Message {
  id: string;
  createdAt: string;
  role: string;
  content: string;
  parts: { type: string; text: string }[];
}

export interface ChatPayload {
  id: string;
  message: Message;
  dataFiles: any[];
  modelName: string;
  provider: string;
  apiHost: string;
  userToken: string;
  workspaceToken: string;
  workspaceId: string;
  exploration: ExplorationObject;
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

export interface ExplorationObject {
  nodes: any[];
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  shared_with: any[];
  shared_by: any | null;
  user_id: string;
}
