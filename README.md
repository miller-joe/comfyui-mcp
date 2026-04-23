# comfyui-mcp

MCP server for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Generate images from natural language prompts in any MCP-compatible client.

[![GitHub Sponsors](https://img.shields.io/github/sponsors/miller-joe?style=social&logo=github)](https://github.com/sponsors/miller-joe)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/indivisionjoe)

## Status

v0.2 ships the core tools plus upscale, an image proxy, and public-URL support. Current tool surface: `generate_image`, `generate_variations`, `generate_with_workflow`, `refine_image`, `upscale_image`, `list_models`, `list_workflows`, `upload_image`, `generate_with_controlnet`, `generate_with_ip_adapter`, plus a workflow template registry. See Roadmap for what's next.

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

Claude Code:

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
| `--comfyui-url` | `COMFYUI_URL` | `http://127.0.0.1:8188` | ComfyUI HTTP URL used internally by this server |
| `--comfyui-public-url` | `COMFYUI_PUBLIC_URL` | same as `--comfyui-url` | External URL in image URLs returned to clients. Set this when the internal URL is not reachable from MCP clients (common with Docker networks). |
| (no flag) | `COMFYUI_DEFAULT_CKPT` | `sd_xl_base_1.0.safetensors` | Default checkpoint filename |

### Image URLs returned to clients

Generation tools return image URLs like `<comfyui-public-url>/view?filename=…`. If `--comfyui-public-url` is not set, URLs use the internal `--comfyui-url` value.

The server also exposes a proxy endpoint: `GET /images/<filename>?subfolder=&type=output` streams the image bytes through this server, which is useful when clients can reach the MCP server but not ComfyUI directly.

The default checkpoint must match a file in your ComfyUI `models/checkpoints/` directory. Override via `COMFYUI_DEFAULT_CKPT` or pass `checkpoint` as a tool argument.

## Tools

### `generate_image`

Generate an image from a text prompt using ComfyUI's default txt2img workflow.

Parameters: `prompt` (required), `negative_prompt`, `width`, `height`, `steps`, `cfg`, `seed`, `checkpoint`.

### `generate_variations`

Generate multiple variations of the same prompt by varying the seed. Returns all images at once.

Parameters: `prompt` (required), `count` (2–16, default 4), plus the same generation params as `generate_image`, with `base_seed` instead of `seed`.

### `generate_with_workflow`

Submit an arbitrary ComfyUI workflow JSON (full node graph) and return the resulting image URLs. Use this for custom workflows — ControlNet, upscaling, or anything exported from ComfyUI's **Save (API Format)**.

Parameter: `workflow` (object), the complete node graph.

### `refine_image`

Run img2img on a source image. The server fetches a source URL, uploads it to ComfyUI, and runs a denoising pass guided by a new prompt. Lower `denoise` preserves more of the original; higher gives the prompt more freedom.

Parameters: `prompt`, `source_image_url` (required), `denoise` (0–1, default 0.5), plus standard generation params.

### `list_models`

List available checkpoints, LoRAs, samplers, or schedulers on the ComfyUI instance.

Parameter: `kind`, one of `checkpoints` (default), `loras`, `samplers`, `schedulers`.

### `list_workflows`

List built-in workflow templates shipped with this server (currently `txt2img`, `img2img`, `upscale`, `controlnet`, `ip_adapter`).

### `upload_image`

Upload a reference image to ComfyUI for use in img2img, ControlNet, or IP-Adapter workflows.

Parameters: `source_url` or `image_base64` (one required), `filename` (optional), `overwrite` (default false).

Returns: the stored filename, which can be used as the `image` input in workflow nodes like `LoadImage`.

### `generate_with_controlnet`

Generate an image conditioned by a ControlNet preprocessed image (pose skeleton, depth map, canny edges, normal map, etc.) plus a text prompt.

Parameters: `prompt`, `control_image_url` (the preprocessed conditioning image; this tool doesn't run preprocessors), `controlnet_model` (filename from `models/controlnet/`), `strength` (0–2, default 1), `start_percent` / `end_percent` (0–1, controlling when CN is active during sampling), plus standard generation params.

Requires a ControlNet model installed in your ComfyUI `models/controlnet/` directory.

### `generate_with_ip_adapter`

Generate an image using a reference image as a visual/style/subject guide via IP-Adapter.

Parameters: `prompt`, `reference_image_url`, `preset` (e.g. `"STANDARD (medium strength)"`, `"PLUS FACE (portraits)"`, `"VIT-G (medium strength)"`), `weight` (0–3, default 1), `start_at` / `end_at` (0–1), plus standard generation params.

Requires the [ComfyUI-IPAdapter-plus](https://github.com/cubiq/ComfyUI_IPAdapter_plus) custom node pack plus the preset's matching IPAdapter weights and CLIP Vision models.

### Workflow template registry

Save complex workflow JSON once, run by name later. Templates are stored on disk under `--templates-dir` (defaults to `~/.config/comfyui-mcp/templates/<name>.json`) so they survive restarts and are portable across MCP clients.

| Tool | Description |
|---|---|
| `save_workflow_template` | Save a workflow JSON under a named slot. `overwrite=true` to replace. |
| `list_workflow_templates` | List saved templates with descriptions and last-updated timestamp. |
| `get_workflow_template` | Fetch a stored template's JSON plus metadata. |
| `delete_workflow_template` | Delete a stored template. |
| `run_workflow_template` | Run a saved template against ComfyUI and return image URLs. |

Template names must start alphanumeric. Allowed: `a-z`, `A-Z`, `0-9`, `-`, `_`. Max 64 chars.

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

The server is stateless. A single MCP request submits a workflow to ComfyUI, polls `/history/{id}` until complete, and returns image URLs.

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

Shipped in v0.2:

- `generate_image`, `generate_variations`, `generate_with_workflow`
- `refine_image` (img2img from a source URL)
- `upscale_image` (ESRGAN / SwinIR-style model upscale)
- `list_models`, `list_workflows`, `upload_image`
- Image proxy endpoint (`/images/<filename>`) for clients that can't reach ComfyUI directly
- Configurable public URL for externally-correct image URLs
- Workflow template registry (save/list/get/delete/run)
- `generate_with_controlnet` (requires ControlNet models on the ComfyUI side)
- `generate_with_ip_adapter` (requires ComfyUI-IPAdapter-plus pack)

Planned:

- WebSocket progress events for long-running generations.

## License

MIT © Joe Miller

## Support

If this tool saves you time, consider supporting development:

[![GitHub Sponsors](https://img.shields.io/github/sponsors/miller-joe?style=social&logo=github)](https://github.com/sponsors/miller-joe)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/indivisionjoe)

Every contribution funds maintenance, documentation, and the next release.
