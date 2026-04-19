import { Buffer } from "node:buffer";
import type {
  GenerateParams,
  GenerateResult,
  HistoryEntry,
  ObjectInfo,
  PromptSubmitResponse,
  UploadResult,
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
    return this.runWorkflow(workflow);
  }

  async runWorkflow(workflow: Workflow): Promise<GenerateResult> {
    const { prompt_id } = await this.submit(workflow);
    const entry = await this.waitForCompletion(prompt_id);
    return {
      promptId: prompt_id,
      images: extractImageUrls(entry, this.baseUrl),
    };
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

  async getObjectInfo(nodeClass?: string): Promise<ObjectInfo> {
    const url = nodeClass
      ? `${this.baseUrl}/object_info/${encodeURIComponent(nodeClass)}`
      : `${this.baseUrl}/object_info`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ComfyUI object_info fetch failed: ${res.status}`);
    }
    return (await res.json()) as ObjectInfo;
  }

  async listCheckpoints(): Promise<string[]> {
    return this.listNodeOptions("CheckpointLoaderSimple", "ckpt_name");
  }

  async listLoras(): Promise<string[]> {
    return this.listNodeOptions("LoraLoader", "lora_name");
  }

  async listSamplers(): Promise<string[]> {
    return this.listNodeOptions("KSampler", "sampler_name");
  }

  async listSchedulers(): Promise<string[]> {
    return this.listNodeOptions("KSampler", "scheduler");
  }

  async uploadImage(
    data: Buffer | Uint8Array,
    filename: string,
    options: { overwrite?: boolean; subfolder?: string } = {},
  ): Promise<UploadResult> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
    form.append("image", blob, filename);
    form.append("overwrite", options.overwrite ? "true" : "false");
    if (options.subfolder) form.append("subfolder", options.subfolder);

    const res = await fetch(`${this.baseUrl}/upload/image`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(
        `ComfyUI image upload failed: ${res.status} ${await res.text()}`,
      );
    }
    return (await res.json()) as UploadResult;
  }

  async fetchAndUploadImage(
    sourceUrl: string,
    filename?: string,
  ): Promise<UploadResult> {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch source image ${sourceUrl}: ${res.status}`,
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const name = filename ?? deriveFilename(sourceUrl);
    return this.uploadImage(buffer, name);
  }

  private async listNodeOptions(
    nodeClass: string,
    fieldName: string,
  ): Promise<string[]> {
    const info = await this.getObjectInfo(nodeClass);
    const node = info[nodeClass];
    const field = node?.input?.required?.[fieldName];
    if (!Array.isArray(field) || !Array.isArray(field[0])) return [];
    return field[0] as string[];
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

export function extractImageUrls(
  entry: HistoryEntry,
  baseUrl: string,
): string[] {
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

function deriveFilename(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    const last = url.pathname.split("/").pop() ?? "";
    if (last && /\.(png|jpg|jpeg|webp)$/i.test(last)) return last;
  } catch {
    // fall through
  }
  return `upload-${Date.now()}.png`;
}
