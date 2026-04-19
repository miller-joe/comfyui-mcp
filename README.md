# comfyui-mcp

MCP server for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). Generate images from natural language prompts using any MCP-compatible client.

Part of the [MCP Server Series](https://github.com/miller-joe).

[![GitHub Sponsors](https://img.shields.io/github/sponsors/miller-joe?style=social&logo=github)](https://github.com/sponsors/miller-joe)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/indivisionjoe)

## Status

v0.1 — initial scaffold. The `generate_image` tool is implemented. More tools in progress (see Roadmap).

## Install

### npx (no install required)

```bash
npx comfyui-mcp --comfyui-url http://your-comfyui-host:8188
```

### npm

```bash
npm install -g comfyui-mcp
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
| `--comfyui-url` | `COMFYUI_URL` | `http://127.0.0.1:8188` | ComfyUI HTTP URL |
| — | `COMFYUI_DEFAULT_CKPT` | `sd_xl_base_1.0.safetensors` | Default checkpoint filename |

The default checkpoint must match a file installed in your ComfyUI `models/checkpoints/` directory. Override via `COMFYUI_DEFAULT_CKPT` or pass `checkpoint` as a tool argument.

## Tools

### `generate_image`

Generate an image from a text prompt using ComfyUI's default txt2img workflow.

**Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `prompt` | string (required) | — | Text description of the image |
| `negative_prompt` | string | `""` | What to avoid in the image |
| `width` | int (64–2048) | 1024 | Image width in pixels |
| `height` | int (64–2048) | 1024 | Image height in pixels |
| `steps` | int (1–150) | 25 | Number of diffusion steps |
| `cfg` | float (1–30) | 7 | Classifier-free guidance scale |
| `seed` | int | random | Seed for reproducibility |
| `checkpoint` | string | env default | Override the default checkpoint |

**Returns:** One or more image URLs served directly by ComfyUI (`http://<comfyui>/view?filename=…`). These URLs can be passed straight to any client that accepts image URLs.

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
- [ ] `generate_with_workflow` — submit arbitrary/named workflows
- [ ] `list_models` / `list_workflows`
- [ ] `upload_image` — reference images for img2img / ControlNet / IP-Adapter
- [ ] `generate_variations` — batch variations of a prompt
- [ ] `refine_image` — iterative refinement using prior generations
- [ ] Image serving endpoint — return image bytes directly from the MCP server (for clients that can't reach ComfyUI)
- [ ] Workflow template library — bundled txt2img, img2img, upscale, ControlNet workflows

## License

MIT © Joe Miller

## Support

If this tool saves you time, consider supporting development:

[![GitHub Sponsors](https://img.shields.io/github/sponsors/miller-joe?style=social&logo=github)](https://github.com/sponsors/miller-joe)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/indivisionjoe)

Every contribution funds maintenance, documentation, and the next release in the [MCP Server Series](https://github.com/miller-joe).
