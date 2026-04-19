import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";

const generateImageSchema = {
  prompt: z
    .string()
    .min(1)
    .describe("Text prompt describing the image to generate"),
  negative_prompt: z.string().optional().describe("What to avoid in the image"),
  width: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe("Image width in pixels"),
  height: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe("Image height in pixels"),
  steps: z
    .number()
    .int()
    .min(1)
    .max(150)
    .default(25)
    .describe("Number of diffusion steps"),
  cfg: z
    .number()
    .min(1)
    .max(30)
    .default(7)
    .describe("CFG / prompt adherence (1-30)"),
  seed: z.number().int().optional().describe("Seed for reproducibility"),
  checkpoint: z
    .string()
    .optional()
    .describe("Checkpoint filename (defaults to COMFYUI_DEFAULT_CKPT)"),
};

export function registerGenerateImageTool(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "generate_image",
    "Generate an image from a text prompt using ComfyUI's default txt2img workflow. Returns one or more image URLs served directly by the ComfyUI instance.",
    generateImageSchema,
    async (args) => {
      const result = await client.generate({
        prompt: args.prompt,
        negativePrompt: args.negative_prompt,
        width: args.width,
        height: args.height,
        steps: args.steps,
        cfg: args.cfg,
        seed: args.seed,
        checkpoint: args.checkpoint,
      });

      const lines = [
        `Generated ${result.images.length} image(s) (prompt_id: ${result.promptId}):`,
        ...result.images.map((url, i) => `  ${i + 1}. ${url}`),
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
