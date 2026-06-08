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
      "Unique slot name to store the template under (becomes <name>.json on disk). Must start with a letter or digit; only letters, digits, '-', and '_' allowed; max 64 chars. Required.",
    ),
  workflow: z
    .record(z.string(), z.any())
    .describe(
      "Complete ComfyUI workflow as a JSON object keyed by node id (ComfyUI's 'Save (API Format)' export). Required; stored verbatim and later submitted as-is by run_workflow_template, so it should include a SaveImage node to produce output.",
    ),
  description: z
    .string()
    .optional()
    .describe(
      "Optional human-readable note about what the template does; shown by list_workflow_templates. Optional; omit for none.",
    ),
  overwrite: z
    .boolean()
    .default(false)
    .describe(
      "Whether to replace an existing template with the same name. Default false, in which case saving over an existing name throws an error. Set true to update in place (the original createdAt timestamp is preserved).",
    ),
};

const listSchema = {};

const getSchema = {
  name: z
    .string()
    .describe(
      "Name of the saved template to fetch. Must match the same naming rules used when saving (alphanumeric start; letters/digits/'-'/'_'; max 64 chars). Required.",
    ),
};

const deleteSchema = {
  name: z
    .string()
    .describe(
      "Name of the saved template to delete. Must match the saved-template naming rules (alphanumeric start; letters/digits/'-'/'_'; max 64 chars). Required.",
    ),
};

const runSchema = {
  name: z
    .string()
    .describe(
      "Name of a previously saved template to load and run against ComfyUI. Must match the saved-template naming rules (alphanumeric start; letters/digits/'-'/'_'; max 64 chars). Required.",
    ),
};

export function registerTemplateTools(
  server: McpServer,
  client: ComfyUIClient,
  store: TemplateStore,
): void {
  server.tool(
    "save_workflow_template",
    "Persists a ComfyUI workflow JSON to this server's on-disk template registry (one <name>.json file per template, in the server's templates directory) so it can be re-run later by name. Side effects: writes/overwrites a file on the MCP server's local filesystem (NOT the ComfyUI host); does not contact ComfyUI; no auth. By default refuses to clobber an existing name (pass overwrite=true to update; createdAt is preserved on update). Invalid names throw. Returns a text confirmation noting whether it saved or updated and the file path. Use this to capture a reusable graph; then run_workflow_template to execute it, get_workflow_template to inspect it, list_workflow_templates to enumerate, and delete_workflow_template to remove it.",
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
    "Lists all workflow templates previously saved with save_workflow_template by reading the server's templates directory. Read-only; does not contact ComfyUI, no side effects, no auth. Returns a text block with the count and one row per template (name, optional description, and last-updated timestamp), or a message that none are saved / the directory does not exist yet. Use this to discover names to pass to run_workflow_template or get_workflow_template; use list_workflows for the built-in (non-user) workflows instead.",
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
    "Fetches a single saved template's stored record by name and returns its raw JSON. Read-only; reads one file from the server's templates directory, does not contact ComfyUI, no side effects, no auth. Throws if the template does not exist. Returns a text block containing the stored JSON: name, optional description, createdAt, updatedAt, and the full workflow graph. Use this to inspect or copy a template's graph (e.g. to tweak and re-save); use run_workflow_template to actually execute it.",
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
    "Permanently deletes a saved workflow template by name from the server's templates directory. Side effects: removes a file from the MCP server's local filesystem; IRREVERSIBLE (no trash/undo); does not contact ComfyUI; no auth. Throws if the template does not exist. Returns a text confirmation that the named template was deleted. Use this to clean up unused templates; use get_workflow_template first if you want to back up the graph before removing it.",
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
    "Loads a previously saved template by name and submits its workflow graph to ComfyUI, polling /history until it completes (timeout 10 minutes). Side effects: enqueues a job on the ComfyUI host and writes whatever output the stored graph produces (typically a PNG via its SaveImage node); idempotency depends on the saved graph (e.g. fixed vs random seed); no auth. Throws if the template does not exist. Returns a text block with the template name, the prompt_id, and the produced image URL(s) (<comfyui-public-url>/view?...). Use this to re-run a captured pipeline; use generate_with_workflow to run a one-off graph without saving it, and save_workflow_template to create the template first.",
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
