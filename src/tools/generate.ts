import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import type { Workflow } from "../comfyui/types.js";

const generateImageSchema = {
  prompt: z
    .string()
    .min(1)
    .describe(
      "Positive text prompt describing the desired image. Required, non-empty. Plain English or comma-separated tags both work.",
    ),
  negative_prompt: z
    .string()
    .optional()
    .describe(
      "Text describing things to avoid in the image (artifacts, styles, objects). Optional; defaults to an empty string (no negative conditioning).",
    ),
  width: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe(
      "Output image width in pixels. Integer between 64 and 2048. Default 1024. For SDXL checkpoints, multiples of 64 near 1024 give best results.",
    ),
  height: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe(
      "Output image height in pixels. Integer between 64 and 2048. Default 1024. For SDXL checkpoints, multiples of 64 near 1024 give best results.",
    ),
  steps: z
    .number()
    .int()
    .min(1)
    .max(150)
    .default(25)
    .describe(
      "Number of diffusion sampling steps. Integer between 1 and 150. Default 25. Higher means more detail/time; diminishing returns past ~30-40.",
    ),
  cfg: z
    .number()
    .min(1)
    .max(30)
    .default(7)
    .describe(
      "Classifier-free guidance scale controlling how strictly the result follows the prompt. Number between 1 and 30. Default 7. Higher = closer to prompt but can over-saturate.",
    ),
  seed: z
    .number()
    .int()
    .optional()
    .describe(
      "Integer RNG seed for reproducibility; the same seed plus identical settings reproduces the same image. Optional; defaults to a random 32-bit seed each call.",
    ),
  checkpoint: z
    .string()
    .optional()
    .describe(
      "Checkpoint (base model) filename to load, e.g. 'sd_xl_base_1.0.safetensors'. Must exist in ComfyUI's models/checkpoints/ (call list_models with kind=checkpoints to discover valid names). Optional; defaults to the COMFYUI_DEFAULT_CKPT env var or 'sd_xl_base_1.0.safetensors'.",
    ),
};

const generateVariationsSchema = {
  prompt: z
    .string()
    .min(1)
    .describe(
      "Positive text prompt used for every variation. Required, non-empty.",
    ),
  count: z
    .number()
    .int()
    .min(2)
    .max(16)
    .default(4)
    .describe(
      "How many variations to generate. Integer between 2 and 16. Default 4. Each variation uses base_seed + index, so they share the prompt but differ by seed.",
    ),
  negative_prompt: z
    .string()
    .optional()
    .describe(
      "Text describing things to avoid, applied to every variation. Optional; defaults to no negative conditioning.",
    ),
  width: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe(
      "Output width in pixels for all variations. Integer 64-2048. Default 1024.",
    ),
  height: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe(
      "Output height in pixels for all variations. Integer 64-2048. Default 1024.",
    ),
  steps: z
    .number()
    .int()
    .min(1)
    .max(150)
    .default(25)
    .describe(
      "Diffusion sampling steps applied to every variation. Integer 1-150. Default 25.",
    ),
  cfg: z
    .number()
    .min(1)
    .max(30)
    .default(7)
    .describe(
      "Classifier-free guidance scale (prompt adherence) applied to every variation. Number 1-30. Default 7.",
    ),
  base_seed: z
    .number()
    .int()
    .optional()
    .describe(
      "Integer seed for the first variation; subsequent variations use base_seed + i (i = 0..count-1). Optional; defaults to a random 32-bit starting seed. Reuse the same base_seed to reproduce the exact set.",
    ),
  checkpoint: z
    .string()
    .optional()
    .describe(
      "Checkpoint (base model) filename used for all variations. Must exist in ComfyUI's models/checkpoints/. Optional; defaults to COMFYUI_DEFAULT_CKPT or 'sd_xl_base_1.0.safetensors'.",
    ),
};

const generateWithWorkflowSchema = {
  workflow: z
    .record(z.string(), z.any())
    .describe(
      "Complete ComfyUI workflow as a JSON object keyed by node id (the prompt graph from ComfyUI's 'Save (API Format)' export, NOT the editor/UI save format). Each value is a node with 'class_type' and 'inputs'. Required; submitted to ComfyUI as-is, so it must include a SaveImage node for any images to be returned.",
    ),
};

export function registerGenerateTools(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "generate_image",
    "Generates an image from a text prompt using this server's built-in SDXL text-to-image (txt2img) workflow: it enqueues a job on the configured ComfyUI instance and polls /history until the job completes (timeout 10 minutes). Side effects: enqueues a ComfyUI job and writes output PNG file(s) on the ComfyUI host; not idempotent (a random seed is used unless you pass one), requires no auth. Returns a text block listing the generated image URL(s) of the form <comfyui-public-url>/view?filename=... plus the ComfyUI prompt_id. Use this for standard single text-to-image generation; use generate_variations for several seed-varied results at once, generate_with_workflow or run_workflow_template to run a custom node graph, refine_image for img2img on an existing image, and the conditioning tools for ControlNet/IP-Adapter guidance.",
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
    "Generates several images from one prompt by running the txt2img workflow `count` times with consecutive seeds (base_seed, base_seed+1, ...), submitting the jobs to ComfyUI in parallel and waiting for all to finish. Side effects: enqueues `count` ComfyUI jobs and writes `count` PNG file(s) on the ComfyUI host; not idempotent unless you pin base_seed; no auth. Returns a text block listing all generated image URL(s) (<comfyui-public-url>/view?...) and the starting seed. Use this to explore a concept or pick the best of several takes; use generate_image for a single image, or refine_image/the conditioning tools when you need img2img or guided control.",
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
    "Submits an arbitrary, caller-supplied ComfyUI workflow graph as-is, then polls /history until it completes (timeout 10 minutes). This is the escape hatch for any pipeline the built-in tools do not cover (custom samplers, LoRAs, multi-stage graphs, etc.). Side effects: enqueues whatever the workflow does on the ComfyUI host (may write files, load models); behavior and idempotency depend entirely on the submitted graph; no auth. The workflow must contain a SaveImage node or nothing will be returned; invalid graphs raise the node_errors reported by ComfyUI. Returns a text block listing produced image URL(s) (<comfyui-public-url>/view?...) and the prompt_id. Use this for one-off custom graphs; use save_workflow_template + run_workflow_template to persist and re-run a graph by name, and the higher-level tools (generate_image, refine_image, upscale_image, generate_with_controlnet, generate_with_ip_adapter) when they fit.",
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
