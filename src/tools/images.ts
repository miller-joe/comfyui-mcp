import { Buffer } from "node:buffer";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";

const uploadImageSchema = {
  source_url: z
    .string()
    .url()
    .optional()
    .describe(
      "HTTP(S) URL to fetch the image bytes from. Provide exactly one of source_url or image_base64 (if both are given, source_url is used). Optional individually, but at least one source is required.",
    ),
  image_base64: z
    .string()
    .optional()
    .describe(
      "Raw base64-encoded image bytes, WITHOUT any 'data:image/...;base64,' prefix. Provide exactly one of source_url or image_base64. Optional individually, but at least one source is required.",
    ),
  filename: z
    .string()
    .optional()
    .describe(
      "Filename to store the image under on the ComfyUI side (referenced later as 'image' in LoadImage nodes). Optional; for source_url it defaults to the URL's basename (or a timestamped .png name), and for image_base64 it defaults to a timestamped 'upload-<ms>.png'.",
    ),
  overwrite: z
    .boolean()
    .default(false)
    .describe(
      "Whether to overwrite an existing ComfyUI file with the same name. Default false. Only honored for the image_base64 path; the source_url path always uploads without overwrite.",
    ),
};

export function registerImageTools(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "upload_image",
    "Uploads an image into ComfyUI's input store so it can be referenced by name in later workflows (LoadImage nodes for img2img, ControlNet, IP-Adapter, etc.). Source is either source_url (fetched over HTTP) or raw image_base64 (provide exactly one; missing both throws). Side effects: writes a file into ComfyUI's input directory on the ComfyUI host; no generation is run; no auth. Returns a text confirmation with the stored filename, its subfolder, and its type. Use this when you want to pre-stage an image for generate_with_workflow / run_workflow_template; note the higher-level tools (refine_image, upscale_image, generate_with_controlnet, generate_with_ip_adapter) already fetch-and-upload their input URLs for you, so you usually do not need to call this first.",
    uploadImageSchema,
    async (args) => {
      if (!args.source_url && !args.image_base64) {
        throw new Error("Must provide either source_url or image_base64");
      }

      const result = args.source_url
        ? await client.fetchAndUploadImage(args.source_url, args.filename)
        : await client.uploadImage(
            Buffer.from(args.image_base64!, "base64"),
            args.filename ?? `upload-${Date.now()}.png`,
            { overwrite: args.overwrite },
          );

      return {
        content: [
          {
            type: "text" as const,
            text: `Uploaded: ${result.name} (subfolder: ${result.subfolder || "(root)"}, type: ${result.type})`,
          },
        ],
      };
    },
  );
}
