import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { ComfyUIClient } from "./comfyui/client.js";
import { registerGenerateTools } from "./tools/generate.js";
import { registerRefineTool } from "./tools/refine.js";
import { registerModelTools } from "./tools/models.js";
import { registerImageTools } from "./tools/images.js";

export interface ServerConfig {
  host: string;
  port: number;
  comfyUIUrl: string;
}

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

export async function startServer(config: ServerConfig): Promise<void> {
  const client = new ComfyUIClient(config.comfyUIUrl);
  const sessions = new Map<string, Session>();

  const buildServer = () => {
    const s = new McpServer({ name: "comfyui-mcp", version: "0.1.1" });
    registerGenerateTools(s, client);
    registerRefineTool(s, client);
    registerModelTools(s, client);
    registerImageTools(s, client);
    return s;
  };

  const httpServer = createServer(async (req, res) => {
    try {
      await handleRequest(req, res, sessions, buildServer);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: (err as Error).message },
            id: null,
          }),
        );
      }
    }
  });

  httpServer.listen(config.port, config.host, () => {
    process.stdout.write(
      `comfyui-mcp listening on http://${config.host}:${config.port} (ComfyUI: ${config.comfyUIUrl})\n`,
    );
  });

  const shutdown = () => {
    for (const { transport } of sessions.values()) {
      void transport.close();
    }
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, Session>,
  buildServer: () => McpServer,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let body: unknown = undefined;

  if (req.method === "POST") {
    body = await readJsonBody(req);
  }

  let session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session && body !== undefined && isInitializeRequest(body)) {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };
    await server.connect(transport);
    session = { server, transport };
  }

  if (!session) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Bad Request: no valid session. Send initialize first or include Mcp-Session-Id header.",
        },
        id: null,
      }),
    );
    return;
  }

  await session.transport.handleRequest(req, res, body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (raw.length === 0) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
