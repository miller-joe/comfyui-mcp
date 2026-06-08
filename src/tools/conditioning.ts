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
  prompt: z
    .string()
    .min(1)
    .describe(
      "Positive text prompt describing the desired image. Required, non-empty.",
    ),
  negative_prompt: z
    .string()
    .optional()
    .describe(
      "Text describing things to avoid in the image. Optional; defaults to an empty string (no negative conditioning).",
    ),
  control_image_url: z
    .string()
    .url()
    .describe(
      "HTTP(S) URL of the conditioning image (pose skeleton, depth map, canny edges, normal map, etc.). Required. It is fetched and uploaded to ComfyUI before generation. Must ALREADY be the preprocessed control map — this tool does not run preprocessors.",
    ),
  controlnet_model: z
    .string()
    .describe(
      "ControlNet model filename from ComfyUI's models/controlnet/ directory, e.g. 'control_v11p_sd15_openpose.safetensors', 'control_v11f1p_sd15_depth.safetensors', 'control_v11p_sd15_canny.safetensors', or 'controlnet-union-sdxl-1.0.safetensors'. Required; must match the control_image_url's type and your checkpoint's base architecture (SD1.5 vs SDXL).",
    ),
  strength: z
    .number()
    .min(0)
    .max(2)
    .default(1.0)
    .describe(
      "How strongly the ControlNet conditioning influences generation. Number between 0 and 2. Default 1.0 (full). 0 disables it; >1 over-applies.",
    ),
  start_percent: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe(
      "Fraction (0-1) of the sampling timeline at which ControlNet begins applying. Default 0 (apply from the start). Must be <= end_percent.",
    ),
  end_percent: z
    .number()
    .min(0)
    .max(1)
    .default(1)
    .describe(
      "Fraction (0-1) of the sampling timeline at which ControlNet stops applying. Default 1 (apply through the end).",
    ),
  width: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe("Output image width in pixels. Integer 64-2048. Default 1024."),
  height: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe("Output image height in pixels. Integer 64-2048. Default 1024."),
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
      "Checkpoint (base model) filename to load; must exist in ComfyUI's models/checkpoints/ and match the ControlNet model's base architecture. Optional; defaults to COMFYUI_DEFAULT_CKPT or 'sd_xl_base_1.0.safetensors'.",
    ),
};

const ipAdapterSchema = {
  prompt: z
    .string()
    .min(1)
    .describe(
      "Positive text prompt describing the desired image. Required, non-empty.",
    ),
  negative_prompt: z
    .string()
    .optional()
    .describe(
      "Text describing things to avoid in the image. Optional; defaults to an empty string (no negative conditioning).",
    ),
  reference_image_url: z
    .string()
    .url()
    .describe(
      "HTTP(S) URL of the reference image used by IP-Adapter as a visual/style/subject guide. Required; fetched and uploaded to ComfyUI before generation. Unlike ControlNet, this does not need preprocessing.",
    ),
  preset: z
    .string()
    .default("STANDARD (medium strength)")
    .describe(
      `IP-Adapter preset string that selects the matching IPAdapter weights + CLIP Vision models inside ComfyUI. Default 'STANDARD (medium strength)'. Must be one ComfyUI-IPAdapter-plus recognizes; common values: ${IP_ADAPTER_PRESETS.join(" | ")}. FACE presets target portraits; SD1.5-only presets require an SD1.5 checkpoint.`,
    ),
  weight: z
    .number()
    .min(0)
    .max(3)
    .default(1.0)
    .describe(
      "How strongly the reference image guides the output. Number between 0 and 3. Default 1.0. Higher copies more of the reference's look; 0 effectively ignores it.",
    ),
  start_at: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe(
      "Fraction (0-1) of the sampling timeline at which IP-Adapter begins applying. Default 0 (from the start). Must be <= end_at.",
    ),
  end_at: z
    .number()
    .min(0)
    .max(1)
    .default(1)
    .describe(
      "Fraction (0-1) of the sampling timeline at which IP-Adapter stops applying. Default 1 (through the end).",
    ),
  width: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe("Output image width in pixels. Integer 64-2048. Default 1024."),
  height: z
    .number()
    .int()
    .min(64)
    .max(2048)
    .default(1024)
    .describe("Output image height in pixels. Integer 64-2048. Default 1024."),
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
      "Checkpoint (base model) filename to load; must exist in ComfyUI's models/checkpoints/ and be compatible with the chosen preset (SD1.5 vs SDXL). Optional; defaults to COMFYUI_DEFAULT_CKPT or 'sd_xl_base_1.0.safetensors'.",
    ),
};

export function registerConditioningTools(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "generate_with_controlnet",
    "Generates an image whose composition is constrained by a ControlNet conditioning map (pose, depth, canny edges, normal map, etc.) plus a text prompt. It fetches control_image_url, uploads it to ComfyUI, builds a ControlNet workflow, submits it, and polls /history until done (timeout 10 minutes). Requirements/side effects: the named ControlNet model must already be installed in ComfyUI's models/controlnet/; the control image must already be preprocessed (this tool runs NO preprocessors); enqueues a job and writes an output PNG on the ComfyUI host; not idempotent unless seed is pinned; no auth. Returns a text block with the generated image URL(s) (<comfyui-public-url>/view?...), the ControlNet model name, and the prompt_id. Use this when you need structural control over layout; use generate_with_ip_adapter for style/subject transfer instead of structure, refine_image for plain img2img, or generate_image for unconstrained text-to-image.",
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
    "Generates an image that borrows the visual style/subject of a reference image via IP-Adapter, combined with a text prompt. It fetches reference_image_url, uploads it to ComfyUI, builds an IP-Adapter workflow with the chosen preset, submits it, and polls /history until done (timeout 10 minutes). Requirements/side effects: needs the ComfyUI-IPAdapter-plus custom node pack plus the preset's matching IPAdapter and CLIP-Vision models installed (missing ones cause a ComfyUI node error); enqueues a job and writes an output PNG on the ComfyUI host; not idempotent unless seed is pinned; no auth. Returns a text block with the generated image URL(s) (<comfyui-public-url>/view?...), the preset, the weight, and the prompt_id. Use this for style/identity transfer from a reference; use generate_with_controlnet when you instead need to lock in pose/structure, or generate_image for plain text-to-image.",
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
