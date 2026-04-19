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
    .describe("Text prompt describing the desired refined image"),
  source_image_url: z
    .string()
    .url()
    .describe(
      "URL of the source image to refine. Will be fetched and uploaded to ComfyUI.",
    ),
  denoise: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe(
      "How much to change the source image (0 = no change, 1 = fully regenerate). Typical: 0.3-0.7",
    ),
  negative_prompt: z.string().optional(),
  steps: z.number().int().min(1).max(150).default(25),
  cfg: z.number().min(1).max(30).default(7),
  seed: z.number().int().optional(),
  checkpoint: z.string().optional(),
};

export function registerRefineTool(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "refine_image",
    "Refine an existing image using img2img: fetch the source image, upload it to ComfyUI, and run a denoising pass guided by the prompt. Lower denoise preserves more of the original; higher denoise gives more freedom to the prompt.",
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
