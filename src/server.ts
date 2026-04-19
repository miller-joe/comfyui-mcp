import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { ComfyUIClient } from "./comfyui/client.js";
import { registerGenerateImageTool } from "./tools/generate.js";

export interface ServerConfig {
  host: string;
  port: number;
  comfyUIUrl: string;
}

export async function startServer(config: ServerConfig): Promise<void> {
  const client = new ComfyUIClient(config.comfyUIUrl);

  const server = new McpServer({
    name: "comfyui-mcp",
    version: "0.1.0",
  });

  registerGenerateImageTool(server, client);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);

  const httpServer = createServer((req, res) => {
    void transport.handleRequest(req, res);
  });

  httpServer.listen(config.port, config.host, () => {
    process.stdout.write(
      `comfyui-mcp listening on http://${config.host}:${config.port} (ComfyUI: ${config.comfyUIUrl})\n`,
    );
  });

  const shutdown = () => {
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
