#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { GeminiImageClient } from "./gemini.js";

const generateImageSchema = z.object({
  prompt: z.string().describe("Description of the image to generate"),
  aspectRatio: z
    .enum(["1:1", "3:4", "4:3", "9:16", "16:9"])
    .optional()
    .default("1:1")
    .describe("Aspect ratio of the generated image"),
  imageSize: z
    .enum(["1K", "2K", "4K"])
    .optional()
    .default("1K")
    .describe("Resolution of the generated image"),
  model: z
    .string()
    .optional()
    .describe("Gemini model to use (default: gemini-3-pro-image-preview)"),
});

export function createServer(apiKey: string): Server {
  const client = new GeminiImageClient(apiKey);

  const server = new Server(
    {
      name: "nano-banana-pro-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "generate_image",
          description:
            "Generate an image using Google Gemini. Returns a base64-encoded image that can be displayed or saved.",
          inputSchema: {
            type: "object" as const,
            properties: {
              prompt: {
                type: "string",
                description: "Description of the image to generate",
              },
              aspectRatio: {
                type: "string",
                enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
                description: "Aspect ratio of the generated image",
                default: "1:1",
              },
              imageSize: {
                type: "string",
                enum: ["1K", "2K", "4K"],
                description: "Resolution of the generated image",
                default: "1K",
              },
              model: {
                type: "string",
                description:
                  "Gemini model (gemini-3-pro-image-preview, gemini-2.5-flash-preview-05-20, or gemini-2.0-flash-exp)",
                default: "gemini-3-pro-image-preview",
              },
            },
            required: ["prompt"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "generate_image") {
      try {
        const args = generateImageSchema.parse(request.params.arguments);
        const result = await client.generateImage(args);

        return {
          content: [
            {
              type: "image" as const,
              data: result.base64Data,
              mimeType: result.mimeType,
            },
            ...(result.description
              ? [{ type: "text" as const, text: result.description }]
              : []),
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Failed to generate image: ${message}`,
            },
          ],
        };
      }
    }

    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `Unknown tool: ${request.params.name}`,
        },
      ],
    };
  });

  return server;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    console.error("Set it with: export GEMINI_API_KEY=your_key_here");
    process.exit(1);
  }

  const server = createServer(apiKey);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("Nano Banana Pro MCP server started");
}

// Only run main when executed directly (not when imported for testing)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("nano-banana-pro-mcp");

if (isMainModule) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
