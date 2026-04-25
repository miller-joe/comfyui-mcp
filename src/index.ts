#!/usr/bin/env node
import { parseArgs } from "node:util";
import { startServer, startStdioServer } from "./server.js";
import { defaultTemplatesDir } from "./tools/templates.js";

const { values } = parseArgs({
  options: {
    host: { type: "string" },
    port: { type: "string" },
    "comfyui-url": { type: "string" },
    "comfyui-public-url": { type: "string" },
    "templates-dir": { type: "string" },
    stdio: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  process.stdout.write(
    [
      "comfyui-mcp — MCP server for ComfyUI",
      "",
      "Usage: comfyui-mcp [options]",
      "",
      "Options:",
      "  --host <host>               Bind host (default: 0.0.0.0, env: MCP_HOST)",
      "  --port <port>               Bind port (default: 9100, env: MCP_PORT)",
      "  --comfyui-url <url>         ComfyUI HTTP URL this server uses internally",
      "                              (default: http://127.0.0.1:8188, env: COMFYUI_URL)",
      "  --comfyui-public-url <url>  External URL used in image URLs returned to clients.",
      "                              Set this when the internal URL is not reachable from",
      "                              MCP clients (common with Docker networks).",
      "                              (default: same as --comfyui-url, env: COMFYUI_PUBLIC_URL)",
      "  --templates-dir <path>      Directory for the workflow template registry.",
      "                              (default: $XDG_CONFIG_HOME/comfyui-mcp/templates or",
      "                              ~/.config/comfyui-mcp/templates, env: COMFYUI_TEMPLATES_DIR)",
      "  --stdio                     Speak MCP over stdio instead of starting an HTTP",
      "                              server. Use this when launched as a subprocess by",
      "                              an MCP client (Claude Desktop, mcp-inspector, etc.)",
      "                              (env: MCP_TRANSPORT=stdio)",
      "  -h, --help                  Show this help",
      "",
      "The server also exposes a /images/<filename> proxy endpoint that streams images",
      "from ComfyUI — useful when clients can reach the MCP server but not ComfyUI.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const host = values.host ?? process.env.MCP_HOST ?? "0.0.0.0";
const port = Number(values.port ?? process.env.MCP_PORT ?? "9100");
const comfyUIUrl =
  values["comfyui-url"] ?? process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";
const comfyUIPublicUrl =
  values["comfyui-public-url"] ?? process.env.COMFYUI_PUBLIC_URL;
const templatesDir =
  values["templates-dir"] ??
  process.env.COMFYUI_TEMPLATES_DIR ??
  defaultTemplatesDir();

const useStdio = values.stdio || process.env.MCP_TRANSPORT === "stdio";
const config = { host, port, comfyUIUrl, comfyUIPublicUrl, templatesDir };
if (useStdio) {
  await startStdioServer(config);
} else {
  await startServer(config);
}
