import type { Workflow } from "./types.js";

export interface Txt2ImgParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  checkpoint: string;
}

export function txt2img(params: Txt2ImgParams): Workflow {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: params.checkpoint },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width: params.width, height: params.height, batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: params.prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: params.negativePrompt, clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui-mcp", images: ["8", 0] },
    },
  };
}
