#!/usr/bin/env node
import { parseArgs } from "node:util";
import { startServer } from "./server.js";

const { values } = parseArgs({
  options: {
    host: { type: "string" },
    port: { type: "string" },
    "comfyui-url": { type: "string" },
    "comfyui-public-url": { type: "string" },
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

await startServer({ host, port, comfyUIUrl, comfyUIPublicUrl });
