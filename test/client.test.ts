import { test } from "node:test";
import assert from "node:assert/strict";
import { extractImageUrls } from "../src/comfyui/client.js";
import type { HistoryEntry } from "../src/comfyui/types.js";

test("extractImageUrls: builds view URLs for each image output", () => {
  const entry: HistoryEntry = {
    prompt: null,
    outputs: {
      "9": {
        images: [
          { filename: "a.png", subfolder: "", type: "output" },
          { filename: "b.png", subfolder: "runs", type: "output" },
        ],
      },
      "12": {
        images: [{ filename: "c.png", subfolder: "", type: "temp" }],
      },
    },
    status: { status_str: "success", completed: true, messages: [] },
  };

  const urls = extractImageUrls(entry, "http://comfyui:8188");
  assert.equal(urls.length, 3);
  assert.ok(
    urls[0].startsWith("http://comfyui:8188/view?"),
    "expected view URL prefix",
  );
  assert.ok(urls[0].includes("filename=a.png"));
  assert.ok(urls[1].includes("subfolder=runs"));
  assert.ok(urls[2].includes("type=temp"));
});

test("extractImageUrls: tolerates outputs without images", () => {
  const entry: HistoryEntry = {
    prompt: null,
    outputs: { "1": {}, "2": { images: [] } },
  };
  assert.deepEqual(extractImageUrls(entry, "http://h"), []);
});
