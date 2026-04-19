import type {
  GenerateParams,
  GenerateResult,
  HistoryEntry,
  PromptSubmitResponse,
  Workflow,
} from "./types.js";
import { txt2img } from "./workflows.js";

const DEFAULT_CHECKPOINT =
  process.env.COMFYUI_DEFAULT_CKPT ?? "sd_xl_base_1.0.safetensors";
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export class ComfyUIClient {
  constructor(private readonly baseUrl: string) {}

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const workflow = txt2img({
      prompt: params.prompt,
      negativePrompt: params.negativePrompt ?? "",
      width: params.width ?? 1024,
      height: params.height ?? 1024,
      steps: params.steps ?? 25,
      cfg: params.cfg ?? 7,
      seed: params.seed ?? Math.floor(Math.random() * 2 ** 32),
      checkpoint: params.checkpoint ?? DEFAULT_CHECKPOINT,
    });

    const { prompt_id } = await this.submit(workflow);
    const entry = await this.waitForCompletion(prompt_id);
    const images = extractImageUrls(entry, this.baseUrl);

    return { promptId: prompt_id, images };
  }

  async submit(workflow: Workflow): Promise<PromptSubmitResponse> {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!res.ok) {
      throw new Error(
        `ComfyUI submit failed: ${res.status} ${await res.text()}`,
      );
    }

    const body = (await res.json()) as PromptSubmitResponse;
    if (body.node_errors && Object.keys(body.node_errors).length > 0) {
      throw new Error(
        `ComfyUI workflow errors: ${JSON.stringify(body.node_errors)}`,
      );
    }
    return body;
  }

  async getHistory(promptId: string): Promise<HistoryEntry | null> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!res.ok) {
      throw new Error(`ComfyUI history fetch failed: ${res.status}`);
    }
    const body = (await res.json()) as Record<string, HistoryEntry>;
    return body[promptId] ?? null;
  }

  private async waitForCompletion(promptId: string): Promise<HistoryEntry> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const entry = await this.getHistory(promptId);
      if (entry?.status?.completed) {
        return entry;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(
      `ComfyUI generation timed out after ${POLL_TIMEOUT_MS}ms (prompt ${promptId})`,
    );
  }
}

function extractImageUrls(entry: HistoryEntry, baseUrl: string): string[] {
  const urls: string[] = [];
  for (const output of Object.values(entry.outputs)) {
    for (const image of output.images ?? []) {
      const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder,
        type: image.type,
      });
      urls.push(`${baseUrl}/view?${params.toString()}`);
    }
  }
  return urls;
}
