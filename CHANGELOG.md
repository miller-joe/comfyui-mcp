# Changelog

All notable changes to comfyui-mcp are documented here.

## 0.3.0 — 2026-04-25

### Added
- `--stdio` flag (and `MCP_TRANSPORT=stdio` env var) — speak MCP over stdio instead of HTTP, for use with stdio-first MCP clients (Claude Desktop, mcp-inspector). HTTP remains the default. Sample Claude Desktop config in the README.
- Glama "Card Badge" in the README, linking to the listing.
- Repository topics (`mcp`, `comfyui`, `stable-diffusion`, `ai-tools`, ...).

### Improved
- All tool descriptions rewritten to cover what each tool does, side effects, return shape, and when to reach for it vs. an alternative. Targets glama.ai's per-tool quality rubric.

## 0.2.1 — earlier

ControlNet, IP-Adapter, and workflow-template registry tools (save/list/get/delete/run).

## 0.2.0 — earlier

Upscaler tool, image proxy endpoint, public-URL support for Docker network setups.

## 0.1.x — initial releases

Core text-to-image, variations, refine (img2img), generate-with-workflow, model listing, image upload.
