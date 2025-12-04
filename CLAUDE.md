# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server that wraps Google's Gemini 3 Nano Banana Pro image generation API, enabling AI agents to generate images via a standardized tool interface.

## Commands

```bash
npm run build      # Compile TypeScript to dist/
npm test           # Run tests with vitest
npm run test:watch # Run tests in watch mode
npm run typecheck  # Type check without emitting
npm start          # Run the MCP server (requires GEMINI_API_KEY env var)
```

## Architecture

- `src/index.ts` - MCP server setup with tool registration. Exports `createServer(apiKey)` for testing.
- `src/gemini.ts` - `GeminiImageClient` class that handles Gemini API requests
- `src/types.ts` - TypeScript interfaces for Gemini API request/response shapes

The server exposes one tool: `generate_image` with parameters for prompt, aspect ratio, and image size.

## Testing

Tests use vitest with mocked fetch. The MCP server tests use `@modelcontextprotocol/sdk`'s `InMemoryTransport` for end-to-end tool invocation testing without network calls.

## Important

- Never commit API keys. The `.gitignore` excludes `.env` files.
- The Gemini API returns images as base64-encoded data which the MCP server passes through as `image` content type.
