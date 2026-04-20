# comfyui-mcp

MCP server for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Generate images from natural language prompts using any MCP-compatible client.

Part of the [MCP Server Series](https://github.com/miller-joe).

[![GitHub Sponsors](https://img.shields.io/github/sponsors/miller-joe?style=social&logo=github)](https://github.com/sponsors/miller-joe)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/indivisionjoe)

## Status

v0.2 — core tools plus upscale, image proxy, and public-URL support. Tools: `generate_image`, `generate_variations`, `generate_with_workflow`, `refine_image`, `upscale_image`, `list_models`, `list_workflows`, `upload_image`. See Roadmap for what's next.

## Install

### npx (no install required)

```bash
npx @miller-joe/comfyui-mcp --comfyui-url http://your-comfyui-host:8188
```

### npm

```bash
npm install -g @miller-joe/comfyui-mcp
comfyui-mcp --comfyui-url http://your-comfyui-host:8188
```

### Docker

```bash
docker run -p 9100:9100 \
  -e COMFYUI_URL=http://your-comfyui-host:8188 \
  ghcr.io/miller-joe/comfyui-mcp:latest
```

## Connect an MCP client

Example — Claude Code:

```bash
claude mcp add --transport http comfyui http://localhost:9100/mcp
```

Or register the streamable HTTP endpoint with an MCP gateway (e.g. MetaMCP) to aggregate with other servers.

## Configuration

All options can be set via CLI flag or environment variable:

| CLI flag | Env var | Default | Description |
|---|---|---|---|
| `--host` | `MCP_HOST` | `0.0.0.0` | Bind host |
| `--port` | `MCP_PORT` | `9100` | Bind port |
| `--comfyui-url` | `COMFYUI_URL` | `http://127.0.0.1:8188` | ComfyUI HTTP URL (used internally by this server to call ComfyUI) |
| `--comfyui-public-url` | `COMFYUI_PUBLIC_URL` | (same as `--comfyui-url`) | Externally-reachable URL used in image URLs returned to MCP clients. Set this when the internal URL is not reachable from clients (common with Docker networks). |
| — | `COMFYUI_DEFAULT_CKPT` | `sd_xl_base_1.0.safetensors` | Default checkpoint filename |

### Image URLs returned to clients

Generation tools return image URLs like `<comfyui-public-url>/view?filename=…`. If `--comfyui-public-url` is not set, URLs use the internal `--comfyui-url` value.

The server also exposes a proxy endpoint: `GET /images/<filename>?subfolder=&type=output` streams the image bytes through the MCP server — useful when clients can reach the MCP server but not ComfyUI directly.

The default checkpoint must match a file installed in your ComfyUI `models/checkpoints/` directory. Override via `COMFYUI_DEFAULT_CKPT` or pass `checkpoint` as a tool argument.

## Tools

### `generate_image`

Generate an image from a text prompt using ComfyUI's default txt2img workflow.

Parameters: `prompt` (required), `negative_prompt`, `width`, `height`, `steps`, `cfg`, `seed`, `checkpoint`.

### `generate_variations`

Generate multiple variations of the same prompt by varying the seed. Returns all images at once.

Parameters: `prompt` (required), `count` (2–16, default 4), plus the same generation params as `generate_image`, with `base_seed` instead of `seed`.

### `generate_with_workflow`

Submit an arbitrary ComfyUI workflow JSON (full node graph) and return the resulting image URLs. Use this for custom workflows — ControlNet, upscaling, or anything exported from ComfyUI's **Save (API Format)**.

Parameter: `workflow` (object) — the complete node graph.

### `refine_image`

Run img2img on a source image: fetches a source URL, uploads it to ComfyUI, and runs a denoising pass guided by a new prompt. Lower `denoise` preserves more of the original; higher gives the prompt more freedom.

Parameters: `prompt`, `source_image_url` (required), `denoise` (0–1, default 0.5), plus standard generation params.

### `list_models`

List available checkpoints, LoRAs, samplers, or schedulers on the ComfyUI instance.

Parameter: `kind` — one of `checkpoints` (default), `loras`, `samplers`, `schedulers`.

### `list_workflows`

List built-in workflow templates shipped with this server (currently `txt2img`, `img2img`).

### `upload_image`

Upload a reference image to ComfyUI for use in img2img, ControlNet, or IP-Adapter workflows.

Parameters: `source_url` **or** `image_base64` (one required), `filename` (optional), `overwrite` (default false).

**Returns:** the stored filename, which can be used as the `image` input in workflow nodes like `LoadImage`.

### Workflow template registry

Save complex workflow JSON once, run them by name later. Templates are stored on disk under `--templates-dir` (defaults to `~/.config/comfyui-mcp/templates/<name>.json`) so they survive restarts and are portable across MCP clients.

| Tool | Description |
|---|---|
| `save_workflow_template` | Save a workflow JSON under a named slot. `overwrite=true` to replace. |
| `list_workflow_templates` | List saved templates with descriptions and last-updated timestamp. |
| `get_workflow_template` | Fetch a stored template's JSON + metadata. |
| `delete_workflow_template` | Delete a stored template. |
| `run_workflow_template` | Run a saved template against ComfyUI and return image URLs. |

Template names must start alphanumeric; `a-z`, `A-Z`, `0-9`, `-`, `_`; max 64 chars.

### Return format

All generation tools return image URLs served directly by the ComfyUI instance (`http://<comfyui>/view?filename=…`). These URLs can be passed straight to any client that accepts image URLs.

## Architecture

```
┌────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  MCP client    │────▶│  comfyui-mcp     │────▶│  ComfyUI     │
│  (Claude, etc.)│◀────│  (this server)   │◀────│  instance    │
└────────────────┘     └──────────────────┘     └──────────────┘
     streamable HTTP        HTTP REST + poll
```

The server is stateless. A single MCP request → submit workflow to ComfyUI → poll `/history/{id}` until complete → return image URLs.

## Development

```bash
git clone https://github.com/miller-joe/comfyui-mcp
cd comfyui-mcp
npm install
npm run dev       # hot-reload via tsx watch
npm run build     # compile TS to dist/
npm run typecheck # strict type checking
```

Requires Node 20+.

## Roadmap

- [x] `generate_image` — text-to-image with default workflow
- [x] `generate_with_workflow` — submit arbitrary workflows
- [x] `list_models` / `list_workflows`
- [x] `upload_image` — reference images for img2img / ControlNet / IP-Adapter
- [x] `generate_variations` — batch variations of a prompt
- [x] `refine_image` — img2img refinement from a source URL
- [x] `upscale_image` — ESRGAN/SwinIR-style model upscale
- [x] Image proxy endpoint (`/images/<filename>`) for clients that can't reach ComfyUI
- [x] Configurable public URL for externally-correct image URLs
- [x] Workflow template registry: `save_workflow_template`, `list_workflow_templates`, `get_workflow_template`, `delete_workflow_template`, `run_workflow_template`
- [ ] ControlNet workflow helpers (requires ControlNet models on the ComfyUI side)
- [ ] IP-Adapter workflow helpers
- [ ] WebSocket progress events for long-running generations

## License

MIT © Joe Miller

## Support

If this tool saves you time, consider supporting development:

[![GitHub Sponsors](https://img.shields.io/github/sponsors/miller-joe?style=social&logo=github)](https://github.com/sponsors/miller-joe)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/indivisionjoe)

Every contribution funds maintenance, documentation, and the next release in the [MCP Server Series](https://github.com/miller-joe).
