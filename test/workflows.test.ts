import { test } from "node:test";
import assert from "node:assert/strict";
import { txt2img, img2img, BUILTIN_WORKFLOWS } from "../src/comfyui/workflows.js";

test("txt2img: produces a valid node graph with required nodes", () => {
  const wf = txt2img({
    prompt: "a cat",
    negativePrompt: "blurry",
    width: 512,
    height: 512,
    steps: 20,
    cfg: 7,
    seed: 42,
    checkpoint: "test.safetensors",
  });

  assert.equal(wf["4"].class_type, "CheckpointLoaderSimple");
  assert.equal(wf["4"].inputs.ckpt_name, "test.safetensors");
  assert.equal(wf["3"].class_type, "KSampler");
  assert.equal(wf["3"].inputs.seed, 42);
  assert.equal(wf["3"].inputs.denoise, 1);
  assert.equal(wf["6"].inputs.text, "a cat");
  assert.equal(wf["7"].inputs.text, "blurry");
  assert.equal(wf["5"].inputs.width, 512);
  assert.equal(wf["9"].class_type, "SaveImage");
});

test("img2img: uses VAEEncode from LoadImage and custom denoise", () => {
  const wf = img2img({
    prompt: "a cat",
    negativePrompt: "",
    sourceImage: "cat.png",
    denoise: 0.6,
    steps: 20,
    cfg: 7,
    seed: 99,
    checkpoint: "test.safetensors",
  });

  assert.equal(wf["10"].class_type, "LoadImage");
  assert.equal(wf["10"].inputs.image, "cat.png");
  assert.equal(wf["11"].class_type, "VAEEncode");
  assert.equal(wf["3"].inputs.denoise, 0.6);
  assert.deepEqual(wf["3"].inputs.latent_image, ["11", 0]);
});

test("BUILTIN_WORKFLOWS lists known templates", () => {
  assert.deepEqual([...BUILTIN_WORKFLOWS], ["txt2img", "img2img", "upscale"]);
});
