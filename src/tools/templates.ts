import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ComfyUIClient } from "../comfyui/client.js";
import type { Workflow } from "../comfyui/types.js";

const TEMPLATE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export interface TemplateStore {
  dir: string;
}

export async function ensureTemplatesDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function templatePath(dir: string, name: string): string {
  return path.join(dir, `${name}.json`);
}

function validateName(name: string): void {
  if (!TEMPLATE_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid template name "${name}". Must start with alphanumeric; only letters, digits, '-', '_' allowed; max 64 chars.`,
    );
  }
}

interface StoredTemplate {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  workflow: Workflow;
}

const saveSchema = {
  name: z
    .string()
    .describe(
      "Template name. Letters, digits, '-', '_'; max 64 chars. Must start alphanumeric.",
    ),
  workflow: z
    .record(z.string(), z.any())
    .describe(
      "Complete ComfyUI workflow JSON (from ComfyUI's 'Save (API Format)').",
    ),
  description: z.string().optional(),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Allow overwriting an existing template with the same name."),
};

const listSchema = {};

const getSchema = {
  name: z.string().describe("Template name."),
};

const deleteSchema = {
  name: z.string().describe("Template name to delete."),
};

const runSchema = {
  name: z.string().describe("Saved template name to run."),
};

export function registerTemplateTools(
  server: McpServer,
  client: ComfyUIClient,
  store: TemplateStore,
): void {
  server.tool(
    "save_workflow_template",
    "Save a ComfyUI workflow JSON to the server's template registry under a named slot. Overwrites are disabled by default.",
    saveSchema,
    async (args) => {
      validateName(args.name);
      const file = templatePath(store.dir, args.name);
      let existed = false;
      try {
        await fs.access(file);
        existed = true;
      } catch {
        existed = false;
      }
      if (existed && !args.overwrite) {
        throw new Error(
          `Template "${args.name}" already exists. Pass overwrite=true to replace it.`,
        );
      }
      const now = new Date().toISOString();
      let createdAt = now;
      if (existed) {
        try {
          const prior = JSON.parse(
            await fs.readFile(file, "utf-8"),
          ) as StoredTemplate;
          createdAt = prior.createdAt ?? now;
        } catch {
          // ignore parse failure, treat as fresh create
        }
      }
      const record: StoredTemplate = {
        name: args.name,
        description: args.description,
        createdAt,
        updatedAt: now,
        workflow: args.workflow as Workflow,
      };
      await fs.writeFile(file, JSON.stringify(record, null, 2));
      return {
        content: [
          {
            type: "text" as const,
            text: existed
              ? `Updated template "${args.name}" at ${file}`
              : `Saved template "${args.name}" at ${file}`,
          },
        ],
      };
    },
  );

  server.tool(
    "list_workflow_templates",
    "List all saved workflow templates in the registry.",
    listSchema,
    async () => {
      let entries: string[];
      try {
        entries = await fs.readdir(store.dir);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `No templates directory at ${store.dir} yet.`,
            },
          ],
        };
      }
      const names = entries
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
      if (names.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No templates saved yet." },
          ],
        };
      }
      const rows: string[] = [];
      for (const name of names.sort()) {
        try {
          const raw = await fs.readFile(
            templatePath(store.dir, name),
            "utf-8",
          );
          const t = JSON.parse(raw) as StoredTemplate;
          const desc = t.description ? ` — ${t.description}` : "";
          rows.push(`  ${t.name}${desc} (updated ${t.updatedAt})`);
        } catch {
          rows.push(`  ${name} (unreadable)`);
        }
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Saved templates (${names.length}) in ${store.dir}:\n${rows.join("\n")}`,
          },
        ],
      };
    },
  );

  server.tool(
    "get_workflow_template",
    "Fetch a saved workflow template's JSON and metadata.",
    getSchema,
    async (args) => {
      validateName(args.name);
      let raw: string;
      try {
        raw = await fs.readFile(templatePath(store.dir, args.name), "utf-8");
      } catch {
        throw new Error(`Template "${args.name}" not found.`);
      }
      return {
        content: [{ type: "text" as const, text: raw }],
      };
    },
  );

  server.tool(
    "delete_workflow_template",
    "Delete a saved workflow template.",
    deleteSchema,
    async (args) => {
      validateName(args.name);
      try {
        await fs.unlink(templatePath(store.dir, args.name));
      } catch {
        throw new Error(`Template "${args.name}" not found.`);
      }
      return {
        content: [
          { type: "text" as const, text: `Deleted template "${args.name}".` },
        ],
      };
    },
  );

  server.tool(
    "run_workflow_template",
    "Run a saved workflow template against ComfyUI and return the resulting image URLs.",
    runSchema,
    async (args) => {
      validateName(args.name);
      let raw: string;
      try {
        raw = await fs.readFile(templatePath(store.dir, args.name), "utf-8");
      } catch {
        throw new Error(`Template "${args.name}" not found.`);
      }
      const record = JSON.parse(raw) as StoredTemplate;
      const result = await client.runWorkflow(record.workflow);
      const lines = [
        `Ran template "${record.name}" (prompt_id: ${result.promptId}), ${result.images.length} image(s):`,
        ...result.images.map((u, i) => `  ${i + 1}. ${u}`),
      ];
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    },
  );
}

export function defaultTemplatesDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) {
    return path.join(xdg, "comfyui-mcp", "templates");
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return path.join(home, ".config", "comfyui-mcp", "templates");
}
