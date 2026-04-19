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

export interface Img2ImgParams {
  prompt: string;
  negativePrompt: string;
  sourceImage: string;
  denoise: number;
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

export function img2img(params: Img2ImgParams): Workflow {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: params.denoise,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["11", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: params.checkpoint },
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
      inputs: { filename_prefix: "comfyui-mcp-refine", images: ["8", 0] },
    },
    "10": {
      class_type: "LoadImage",
      inputs: { image: params.sourceImage },
    },
    "11": {
      class_type: "VAEEncode",
      inputs: { pixels: ["10", 0], vae: ["4", 2] },
    },
  };
}

export const BUILTIN_WORKFLOWS = ["txt2img", "img2img"] as const;
export type BuiltinWorkflow = (typeof BUILTIN_WORKFLOWS)[number];
