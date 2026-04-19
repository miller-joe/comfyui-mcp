#!/usr/bin/env node
import { parseArgs } from "node:util";
import { startServer } from "./server.js";

const { values } = parseArgs({
  options: {
    host: { type: "string" },
    port: { type: "string" },
    "comfyui-url": { type: "string" },
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
      "  --host <host>          Bind host (default: 0.0.0.0, env: MCP_HOST)",
      "  --port <port>          Bind port (default: 9100, env: MCP_PORT)",
      "  --comfyui-url <url>    ComfyUI HTTP URL",
      "                         (default: http://127.0.0.1:8188, env: COMFYUI_URL)",
      "  -h, --help             Show this help",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const host = values.host ?? process.env.MCP_HOST ?? "0.0.0.0";
const port = Number(values.port ?? process.env.MCP_PORT ?? "9100");
const comfyUIUrl =
  values["comfyui-url"] ?? process.env.COMFYUI_URL ?? "http://127.0.0.1:8188";

await startServer({ host, port, comfyUIUrl });
