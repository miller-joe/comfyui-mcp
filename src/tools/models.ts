import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import { BUILTIN_WORKFLOWS } from "../comfyui/workflows.js";

const listModelsSchema = {
  kind: z
    .enum(["checkpoints", "loras", "samplers", "schedulers", "upscalers"])
    .default("checkpoints")
    .describe("Which category of resource to list"),
};

export function registerModelTools(
  server: McpServer,
  client: ComfyUIClient,
): void {
  server.tool(
    "list_models",
    "List available models or samplers on the ComfyUI instance. Use this to discover valid values for the 'checkpoint' parameter of other tools, or to see what LoRAs and samplers are installed.",
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
    "List built-in workflow templates shipped with this MCP server. These are the named workflows that can be used as a baseline; for arbitrary workflows use generate_with_workflow.",
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
