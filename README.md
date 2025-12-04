# nano-banana-pro-mcp

MCP server that enables AI agents like Claude to generate images using Google's Gemini 3 Nano Banana Pro image generation model.

## Installation

```bash
npm install
npm run build
```

## Configuration

Set your Gemini API key as an environment variable:

```bash
export GEMINI_API_KEY=your_api_key_here
```

Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "nano-banana-pro": {
      "command": "node",
      "args": ["/path/to/nano-banana-pro-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### generate_image

Generate an image from a text prompt.

**Parameters:**
- `prompt` (required): Description of the image to generate
- `model` (optional): Gemini model to use (default: `gemini-3-pro-image-preview`)
  - `gemini-3-pro-image-preview` - Nano Banana Pro (highest quality)
  - `gemini-2.5-flash-preview-05-20` - Nano Banana (fast)
  - `gemini-2.0-flash-exp` - Widely available fallback
- `aspectRatio` (optional): `"1:1"` | `"3:4"` | `"4:3"` | `"9:16"` | `"16:9"` (only for image-specific models)
- `imageSize` (optional): `"1K"` | `"2K"` | `"4K"` (only for image-specific models)

**Example:**
```
Generate an image of a sunset over mountains
```

## Testing

### Unit Tests

```bash
npm test
```

### Manual Testing (generate a real image)

```bash
# Install dependencies first
npm install

# Generate an image and save to test-output.png
GEMINI_API_KEY=your_key npm run test:manual "a cute cat wearing sunglasses"
```

This will call the real Gemini API and save the generated image to `test-output.png`.

### Testing with MCP Inspector

You can also test the full MCP server using [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Then set `GEMINI_API_KEY` in the inspector's environment and call the `generate_image` tool.

## Development

```bash
npm install        # Install dependencies
npm run build      # Build TypeScript
npm test           # Run unit tests
npm run test:watch # Run tests in watch mode
npm run typecheck  # Type check without emitting
```

## License

MIT
