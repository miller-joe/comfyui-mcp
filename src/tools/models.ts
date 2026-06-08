import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import { BUILTIN_WORKFLOWS } from "../comfyui/workflows.js";

const listModelsSchema = {
  kind: z
    .enum(["checkpoints", "loras", "samplers", "schedulers", "upscalers"])
    .default("checkpoints")
    .describe(
      "Which category of installed resource to list. One of: 'checkpoints' (base models), 'loras', 'samplers', 'schedulers', or 'upscalers'. Default 'checkpoints'. Values are read live from the ComfyUI node definitions (object_info).",
    ),
};

export function registerModelTools(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "list_models",
    "Lists the names of one category of resource installed on the connected ComfyUI instance (checkpoints, loras, samplers, schedulers, or upscalers) by querying ComfyUI's /object_info endpoint. Read-only; no side effects, no auth. Returns a text block with the category name, the count, and a numbered list of names (or '(none found)'). Use this first to discover valid values for the 'checkpoint' parameter of the generate/refine/conditioning tools and the 'upscale_model' parameter of upscale_image; use list_workflows to see the built-in workflow templates instead of models.",
    listModelsSchema,
    async (args) => {
      const list = await fetchList(client, args.kind);
      const body =
        list.length > 0
          ? list.map((n, i) => `  ${i + 1}. ${n}`).join("\n")
          : "  (none found)";
      return {
        content: [
          {
            type: "text" as const,
            text: `${args.kind} (${list.length}):\n${body}`,
          },
        ],
      };
    },
  );

  server.tool(
    "list_workflows",
    "Lists the built-in workflow names shipped with this MCP server (txt2img, img2img, upscale, controlnet, ip_adapter). Read-only; reads a static in-code list, does not contact ComfyUI, no side effects, no auth. Returns a text block with the count and a numbered list of the built-in workflow names. These name the pipelines exposed by the dedicated tools (generate_image, refine_image, upscale_image, generate_with_controlnet, generate_with_ip_adapter); for an arbitrary custom graph use generate_with_workflow, and for saved user templates use list_workflow_templates.",
    {},
    async () => {
      const body = BUILTIN_WORKFLOWS.map(
        (name, i) => `  ${i + 1}. ${name}`,
      ).join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `Built-in workflows (${BUILTIN_WORKFLOWS.length}):\n${body}`,
          },
        ],
      };
    },
  );
}

async function fetchList(
  client: ComfyUIClient,
  kind: "checkpoints" | "loras" | "samplers" | "schedulers" | "upscalers",
): Promise<string[]> {
  switch (kind) {
    case "checkpoints":
      return client.listCheckpoints();
    case "loras":
      return client.listLoras();
    case "samplers":
      return client.listSamplers();
    case "schedulers":
      return client.listSchedulers();
    case "upscalers":
      return client.listUpscaleModels();
  }
}
