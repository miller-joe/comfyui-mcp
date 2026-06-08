import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import { upscale } from "../comfyui/workflows.js";

const upscaleImageSchema = {
  source_image_url: z
    .string()
    .url()
    .describe(
      "HTTP(S) URL of the image to upscale. Required; it is fetched and uploaded to ComfyUI before the upscale runs.",
    ),
  upscale_model: z
    .string()
    .describe(
      "Upscaler model filename from ComfyUI's models/upscale_models/ directory, e.g. 'RealESRGAN_x4plus.pth' or '4x-UltraSharp.pth'. Required; the model's native scale factor (e.g. 4x) determines the output size. Call list_models with kind=upscalers to see installed names.",
    ),
};

export function registerUpscaleTool(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "upscale_image",
    "Enlarges/enhances an existing image with a dedicated upscaler model (ESRGAN, SwinIR, etc.) — a pure resolution boost, no diffusion or prompt involved. It fetches source_image_url, uploads it to ComfyUI, runs an ImageUpscaleWithModel workflow, and polls /history until done (timeout 10 minutes). Requirements/side effects: the named model must exist in ComfyUI's models/upscale_models/; enqueues a job and writes an output PNG on the ComfyUI host; deterministic (idempotent given the same input and model); no auth. Returns a text block with the upscaled image URL(s) (<comfyui-public-url>/view?...), the model used, and the prompt_id. Use this for clean resolution increases; use refine_image instead when you want a prompt-guided img2img pass (which can change content), and list_models with kind=upscalers to find valid model names.",
    upscaleImageSchema,
    async (args) => {
      const uploaded = await client.fetchAndUploadImage(args.source_image_url);
      const workflow = upscale({
        sourceImage: uploaded.name,
        upscaleModel: args.upscale_model,
      });
      const result = await client.runWorkflow(workflow);
      const lines = [
        `Upscaled image (prompt_id: ${result.promptId}, model: ${args.upscale_model}):`,
        ...result.images.map((url, i) => `  ${i + 1}. ${url}`),
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
