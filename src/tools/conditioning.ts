import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import { controlnet, ipAdapter } from "../comfyui/workflows.js";

const DEFAULT_CHECKPOINT =
  process.env.COMFYUI_DEFAULT_CKPT ?? "sd_xl_base_1.0.safetensors";

const IP_ADAPTER_PRESETS = [
  "LIGHT - SD1.5 only (low strength)",
  "STANDARD (medium strength)",
  "VIT-G (medium strength)",
  "PLUS (high strength)",
  "PLUS FACE (portraits)",
  "FULL FACE - SD1.5 only (portraits stronger)",
] as const;

const controlnetSchema = {
  prompt: z.string().min(1).describe("Text prompt for the generated image."),
  negative_prompt: z.string().optional(),
  control_image_url: z
    .string()
    .url()
    .describe(
      "URL of the conditioning image (pose skeleton, depth map, canny edges, normal map, etc.). Must already match the control type — ControlNet expects preprocessed input.",
    ),
  controlnet_model: z
    .string()
    .describe(
      "ControlNet model filename from your ComfyUI `models/controlnet/` directory. Examples: 'control_v11p_sd15_openpose.safetensors', 'control_v11f1p_sd15_depth.safetensors', 'control_v11p_sd15_canny.safetensors', 'controlnet-union-sdxl-1.0.safetensors'.",
    ),
  strength: z
    .number()
    .min(0)
    .max(2)
    .default(1.0)
    .describe("How strongly ControlNet influences generation. 1.0 = full."),
  start_percent: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("Fraction of the sampling timeline at which ControlNet starts."),
  end_percent: z
    .number()
    .min(0)
    .max(1)
    .default(1)
    .describe("Fraction of the sampling timeline at which ControlNet stops."),
  width: z.number().int().min(64).max(2048).default(1024),
  height: z.number().int().min(64).max(2048).default(1024),
  steps: z.number().int().min(1).max(150).default(25),
  cfg: z.number().min(1).max(30).default(7),
  seed: z.number().int().optional(),
  checkpoint: z.string().optional(),
};

const ipAdapterSchema = {
  prompt: z.string().min(1).describe("Text prompt for the generated image."),
  negative_prompt: z.string().optional(),
  reference_image_url: z
    .string()
    .url()
    .describe(
      "URL of the reference image that IP-Adapter uses as a visual/style/subject guide.",
    ),
  preset: z
    .string()
    .default("STANDARD (medium strength)")
    .describe(
      `IP-Adapter preset (picks the matching IPAdapter + CLIP Vision models). Common values: ${IP_ADAPTER_PRESETS.join(" | ")}`,
    ),
  weight: z
    .number()
    .min(0)
    .max(3)
    .default(1.0)
    .describe("How strongly the reference guides the output."),
  start_at: z.number().min(0).max(1).default(0),
  end_at: z.number().min(0).max(1).default(1),
  width: z.number().int().min(64).max(2048).default(1024),
  height: z.number().int().min(64).max(2048).default(1024),
  steps: z.number().int().min(1).max(150).default(25),
  cfg: z.number().min(1).max(30).default(7),
  seed: z.number().int().optional(),
  checkpoint: z.string().optional(),
};

export function registerConditioningTools(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "generate_with_controlnet",
    "Generate an image conditioned by a ControlNet preprocessed image (pose, depth, canny, etc.) plus a prompt. Requires a ControlNet model installed in ComfyUI's `models/controlnet/` directory. The control_image_url must already be the preprocessed conditioning image — this tool does not run preprocessors itself.",
    controlnetSchema,
    async (args) => {
      const upload = await client.fetchAndUploadImage(args.control_image_url);

      const workflow = controlnet({
        prompt: args.prompt,
        negativePrompt: args.negative_prompt ?? "",
        controlImage: upload.name,
        controlnetModel: args.controlnet_model,
        strength: args.strength,
        startPercent: args.start_percent,
        endPercent: args.end_percent,
        width: args.width,
        height: args.height,
        steps: args.steps,
        cfg: args.cfg,
        seed: args.seed ?? Math.floor(Math.random() * 2 ** 32),
        checkpoint: args.checkpoint ?? DEFAULT_CHECKPOINT,
      });

      const result = await client.runWorkflow(workflow);
      const lines = [
        `Generated ${result.images.length} image(s) with ControlNet (${args.controlnet_model}, prompt_id: ${result.promptId}):`,
        ...result.images.map((u, i) => `  ${i + 1}. ${u}`),
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "generate_with_ip_adapter",
    "Generate an image using a reference image as an IP-Adapter visual/style/subject guide. Requires the ComfyUI-IPAdapter-plus custom node pack and the preset's matching models (IPAdapter weights + CLIP vision). Weight tunes how strongly the reference guides generation.",
    ipAdapterSchema,
    async (args) => {
      const upload = await client.fetchAndUploadImage(args.reference_image_url);

      const workflow = ipAdapter({
        prompt: args.prompt,
        negativePrompt: args.negative_prompt ?? "",
        referenceImage: upload.name,
        preset: args.preset,
        weight: args.weight,
        startAt: args.start_at,
        endAt: args.end_at,
        width: args.width,
        height: args.height,
        steps: args.steps,
        cfg: args.cfg,
        seed: args.seed ?? Math.floor(Math.random() * 2 ** 32),
        checkpoint: args.checkpoint ?? DEFAULT_CHECKPOINT,
      });

      const result = await client.runWorkflow(workflow);
      const lines = [
        `Generated ${result.images.length} image(s) with IP-Adapter (preset: ${args.preset}, weight: ${args.weight}, prompt_id: ${result.promptId}):`,
        ...result.images.map((u, i) => `  ${i + 1}. ${u}`),
      ];
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
