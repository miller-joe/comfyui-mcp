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

export interface UpscaleParams {
  sourceImage: string;
  upscaleModel: string;
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

export function upscale(params: UpscaleParams): Workflow {
  return {
    "1": {
      class_type: "LoadImage",
      inputs: { image: params.sourceImage },
    },
    "2": {
      class_type: "UpscaleModelLoader",
      inputs: { model_name: params.upscaleModel },
    },
    "3": {
      class_type: "ImageUpscaleWithModel",
      inputs: { upscale_model: ["2", 0], image: ["1", 0] },
    },
    "4": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui-mcp-upscale", images: ["3", 0] },
    },
  };
}

export interface ControlNetParams {
  prompt: string;
  negativePrompt: string;
  controlImage: string;
  controlnetModel: string;
  strength: number;
  startPercent: number;
  endPercent: number;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  checkpoint: string;
}

export function controlnet(params: ControlNetParams): Workflow {
  return {
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
    "10": {
      class_type: "LoadImage",
      inputs: { image: params.controlImage },
    },
    "12": {
      class_type: "ControlNetLoader",
      inputs: { control_net_name: params.controlnetModel },
    },
    "13": {
      class_type: "ControlNetApplyAdvanced",
      inputs: {
        positive: ["6", 0],
        negative: ["7", 0],
        control_net: ["12", 0],
        image: ["10", 0],
        strength: params.strength,
        start_percent: params.startPercent,
        end_percent: params.endPercent,
      },
    },
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
        positive: ["13", 0],
        negative: ["13", 1],
        latent_image: ["5", 0],
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui-mcp-cn", images: ["8", 0] },
    },
  };
}

export interface IPAdapterParams {
  prompt: string;
  negativePrompt: string;
  referenceImage: string;
  preset: string;
  weight: number;
  startAt: number;
  endAt: number;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
  checkpoint: string;
}

/**
 * IP-Adapter workflow. Relies on the ComfyUI-IPAdapter-plus custom node pack
 * (nodes `IPAdapterUnifiedLoader`, `IPAdapterAdvanced`). If the pack or the
 * selected preset's models aren't installed, ComfyUI returns a node error.
 */
export function ipAdapter(params: IPAdapterParams): Workflow {
  return {
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
    "10": {
      class_type: "LoadImage",
      inputs: { image: params.referenceImage },
    },
    "20": {
      class_type: "IPAdapterUnifiedLoader",
      inputs: { model: ["4", 0], preset: params.preset },
    },
    "21": {
      class_type: "IPAdapterAdvanced",
      inputs: {
        model: ["20", 0],
        ipadapter: ["20", 1],
        image: ["10", 0],
        weight: params.weight,
        weight_type: "linear",
        combine_embeds: "concat",
        start_at: params.startAt,
        end_at: params.endAt,
        embeds_scaling: "V only",
      },
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfg,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["21", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "comfyui-mcp-ipa", images: ["8", 0] },
    },
  };
}

export const BUILTIN_WORKFLOWS = [
  "txt2img",
  "img2img",
  "upscale",
  "controlnet",
  "ip_adapter",
] as const;
export type BuiltinWorkflow = (typeof BUILTIN_WORKFLOWS)[number];
