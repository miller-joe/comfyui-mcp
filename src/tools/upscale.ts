import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import { upscale } from "../comfyui/workflows.js";

const upscaleImageSchema = {
  source_image_url: z
    .string()
    .url()
    .describe("URL of the image to upscale. Will be fetched and uploaded to ComfyUI."),
  upscale_model: z
    .string()
    .describe(
      "Upscaler model filename (e.g. RealESRGAN_x4plus.pth). Use list_models with kind=upscalers to see what's installed.",
    ),
};

export function registerUpscaleTool(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "upscale_image",
    "Upscale an image using a loaded upscaler model (ESRGAN, SwinIR, etc.). Fetches the source image, uploads to ComfyUI, runs the upscale node, and returns the output URL. Requires at least one upscaler model in ComfyUI's models/upscale_models/ directory.",
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
