export interface PromptSubmitResponse {
  prompt_id: string;
  number: number;
  node_errors?: Record<string, unknown>;
}

export interface HistoryEntry {
  prompt: unknown;
  outputs: Record<
    string,
    {
      images?: Array<{ filename: string; subfolder: string; type: string }>;
    }
  >;
  status?: { status_str: string; completed: boolean; messages: unknown[] };
}

export interface WorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: Record<string, unknown>;
}

export type Workflow = Record<string, WorkflowNode>;

export interface GenerateParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  checkpoint?: string;
}

export interface GenerateResult {
  promptId: string;
  images: string[];
}

export interface UploadResult {
  name: string;
  subfolder: string;
  type: string;
}

export interface ObjectInfoNode {
  input?: {
    required?: Record<string, unknown>;
    optional?: Record<string, unknown>;
  };
  output?: unknown[];
  output_name?: string[];
  name?: string;
  display_name?: string;
  description?: string;
  category?: string;
}

export type ObjectInfo = Record<string, ObjectInfoNode>;
