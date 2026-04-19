import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import type { Workflow } from "../comfyui/types.js";

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

const generateVariationsSchema = {
  prompt: z.string().min(1).describe("Text prompt for the base image"),
  count: z
    .number()
    .int()
    .min(2)
    .max(16)
    .default(4)
    .describe("Number of variations to generate"),
  negative_prompt: z.string().optional(),
  width: z.number().int().min(64).max(2048).default(1024),
  height: z.number().int().min(64).max(2048).default(1024),
  steps: z.number().int().min(1).max(150).default(25),
  cfg: z.number().min(1).max(30).default(7),
  base_seed: z
    .number()
    .int()
    .optional()
    .describe("Starting seed; subsequent variations use base_seed + i"),
  checkpoint: z.string().optional(),
};

const generateWithWorkflowSchema = {
  workflow: z
    .record(z.string(), z.any())
    .describe(
      "Complete ComfyUI workflow JSON (node graph as returned by ComfyUI's 'Save (API Format)' export)",
    ),
};

export function registerGenerateTools(
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

      return textResult(
        `Generated ${result.images.length} image(s) (prompt_id: ${result.promptId}):`,
        result.images,
      );
    },
  );

  server.tool(
    "generate_variations",
    "Generate multiple variations of the same prompt by varying the seed. Useful for picking the best result or exploring a concept.",
    generateVariationsSchema,
    async (args) => {
      const startSeed = args.base_seed ?? Math.floor(Math.random() * 2 ** 32);
      const results = await Promise.all(
        Array.from({ length: args.count }, (_, i) =>
          client.generate({
            prompt: args.prompt,
            negativePrompt: args.negative_prompt,
            width: args.width,
            height: args.height,
            steps: args.steps,
            cfg: args.cfg,
            seed: startSeed + i,
            checkpoint: args.checkpoint,
          }),
        ),
      );

      const urls = results.flatMap((r) => r.images);
      return textResult(
        `Generated ${args.count} variation(s) starting from seed ${startSeed}:`,
        urls,
      );
    },
  );

  server.tool(
    "generate_with_workflow",
    "Submit an arbitrary ComfyUI workflow (full node graph) and return the resulting image URLs. Use this when you need a custom workflow like ControlNet, upscaling, or a node graph exported from ComfyUI's 'Save (API Format)'.",
    generateWithWorkflowSchema,
    async (args) => {
      const workflow = args.workflow as Workflow;
      const result = await client.runWorkflow(workflow);
      return textResult(
        `Workflow submitted (prompt_id: ${result.promptId}), ${result.images.length} image(s):`,
        result.images,
      );
    },
  );
}

function textResult(header: string, urls: string[]) {
  const lines = [header, ...urls.map((url, i) => `  ${i + 1}. ${url}`)];
  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}
