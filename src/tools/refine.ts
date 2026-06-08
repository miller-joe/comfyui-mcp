import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import { img2img } from "../comfyui/workflows.js";

const DEFAULT_CHECKPOINT =
  process.env.COMFYUI_DEFAULT_CKPT ?? "sd_xl_base_1.0.safetensors";

const refineImageSchema = {
  prompt: z
    .string()
    .min(1)
    .describe(
      "Positive text prompt describing the desired refined image. Required, non-empty; guides the denoising pass.",
    ),
  source_image_url: z
    .string()
    .url()
    .describe(
      "HTTP(S) URL of the source image to refine. Required; it is fetched and uploaded to ComfyUI, then used as the img2img starting latent.",
    ),
  denoise: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe(
      "Denoising strength controlling how much the source is altered. Number between 0 (no change) and 1 (fully regenerate, ignoring the source). Default 0.5; typical useful range 0.3-0.7.",
    ),
  negative_prompt: z
    .string()
    .optional()
    .describe(
      "Text describing things to avoid in the refined image. Optional; defaults to an empty string (no negative conditioning).",
    ),
  steps: z
    .number()
    .int()
    .min(1)
    .max(150)
    .default(25)
    .describe("Diffusion sampling steps. Integer 1-150. Default 25."),
  cfg: z
    .number()
    .min(1)
    .max(30)
    .default(7)
    .describe(
      "Classifier-free guidance scale (prompt adherence). Number 1-30. Default 7.",
    ),
  seed: z
    .number()
    .int()
    .optional()
    .describe(
      "Integer RNG seed for reproducibility. Optional; defaults to a random 32-bit seed each call.",
    ),
  checkpoint: z
    .string()
    .optional()
    .describe(
      "Checkpoint (base model) filename to load; must exist in ComfyUI's models/checkpoints/. Optional; defaults to COMFYUI_DEFAULT_CKPT or 'sd_xl_base_1.0.safetensors'.",
    ),
};

export function registerRefineTool(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "refine_image",
    "Transforms an existing image with prompt-guided img2img: it fetches source_image_url, uploads it to ComfyUI, encodes it to a latent, and runs a denoising pass driven by the prompt (denoise controls how far it strays from the original), polling /history until done (timeout 10 minutes). Side effects: enqueues a job and writes an output PNG on the ComfyUI host; not idempotent unless seed is pinned; no auth. Returns a text block with the refined image URL(s) (<comfyui-public-url>/view?...), the denoise value, the uploaded source filename, and the prompt_id. Use this to edit/reinterpret an existing image (style changes, fixes, variations on a base); use upscale_image for a pure resolution boost with no content change, generate_image for a fresh image from scratch, or the conditioning tools for structural/reference-guided control.",
    refineImageSchema,
    async (args) => {
      const upload = await client.fetchAndUploadImage(args.source_image_url);

      const workflow = img2img({
        prompt: args.prompt,
        negativePrompt: args.negative_prompt ?? "",
        sourceImage: upload.name,
        denoise: args.denoise,
        steps: args.steps,
        cfg: args.cfg,
        seed: args.seed ?? Math.floor(Math.random() * 2 ** 32),
        checkpoint: args.checkpoint ?? DEFAULT_CHECKPOINT,
      });

      const result = await client.runWorkflow(workflow);

      const lines = [
        `Refined image (prompt_id: ${result.promptId}, denoise: ${args.denoise}, source: ${upload.name}):`,
        ...result.images.map((url, i) => `  ${i + 1}. ${url}`),
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
