import { Buffer } from "node:buffer";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";

const uploadImageSchema = {
  source_url: z
    .string()
    .url()
    .optional()
    .describe("URL to fetch the image from. One of source_url or image_base64 is required."),
  image_base64: z
    .string()
    .optional()
    .describe(
      "Base64-encoded image data (without the data:image/... prefix). One of source_url or image_base64 is required.",
    ),
  filename: z
    .string()
    .optional()
    .describe("Filename to save as on the ComfyUI side. Defaults to a timestamped name."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Replace an existing file with the same name"),
};

export function registerImageTools(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "upload_image",
    "Upload a reference image to ComfyUI for use in img2img, ControlNet, or IP-Adapter workflows. Accepts either a source URL (will be fetched) or base64-encoded image data. Returns the stored filename for use as 'image' in workflow nodes like LoadImage.",
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
