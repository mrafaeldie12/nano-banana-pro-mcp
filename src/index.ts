#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { GeminiImageClient } from "./gemini.js";

const imageInputSchema = z.object({
  data: z.string().describe("Base64 encoded image data"),
  mimeType: z.string().describe("MIME type of the image (e.g., image/png, image/jpeg)"),
});

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
  images: z
    .array(imageInputSchema)
    .optional()
    .describe("Optional reference images to guide generation"),
});

const editImageSchema = z.object({
  prompt: z.string().describe("Instructions for how to edit the image(s)"),
  images: z
    .array(imageInputSchema)
    .min(1)
    .describe("One or more images to edit"),
  model: z
    .string()
    .optional()
    .describe("Gemini model to use (default: gemini-3-pro-image-preview)"),
});

const describeImageSchema = z.object({
  images: z
    .array(imageInputSchema)
    .min(1)
    .describe("One or more images to describe/analyze"),
  prompt: z
    .string()
    .optional()
    .describe("Optional custom prompt for analysis (default: general description)"),
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
            "Generate an image using Google Gemini. Optionally provide reference images to guide the generation style or content. Returns a base64-encoded image.",
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
              images: {
                type: "array",
                description: "Optional reference images to guide generation",
                items: {
                  type: "object",
                  properties: {
                    data: { type: "string", description: "Base64 encoded image data" },
                    mimeType: { type: "string", description: "MIME type (e.g., image/png)" },
                  },
                  required: ["data", "mimeType"],
                },
              },
            },
            required: ["prompt"],
          },
        },
        {
          name: "edit_image",
          description:
            "Edit one or more images using Google Gemini. Provide images and instructions for how to modify them. Returns a base64-encoded image.",
          inputSchema: {
            type: "object" as const,
            properties: {
              prompt: {
                type: "string",
                description: "Instructions for how to edit the image(s)",
              },
              images: {
                type: "array",
                description: "One or more images to edit",
                items: {
                  type: "object",
                  properties: {
                    data: { type: "string", description: "Base64 encoded image data" },
                    mimeType: { type: "string", description: "MIME type (e.g., image/png)" },
                  },
                  required: ["data", "mimeType"],
                },
                minItems: 1,
              },
              model: {
                type: "string",
                description:
                  "Gemini model (gemini-3-pro-image-preview, gemini-2.5-flash-preview-05-20, or gemini-2.0-flash-exp)",
                default: "gemini-3-pro-image-preview",
              },
            },
            required: ["prompt", "images"],
          },
        },
        {
          name: "describe_image",
          description:
            "Analyze and describe one or more images using Google Gemini. Returns a text description of the image contents.",
          inputSchema: {
            type: "object" as const,
            properties: {
              images: {
                type: "array",
                description: "One or more images to describe/analyze",
                items: {
                  type: "object",
                  properties: {
                    data: { type: "string", description: "Base64 encoded image data" },
                    mimeType: { type: "string", description: "MIME type (e.g., image/png)" },
                  },
                  required: ["data", "mimeType"],
                },
                minItems: 1,
              },
              prompt: {
                type: "string",
                description: "Optional custom prompt for analysis (default: general description)",
              },
              model: {
                type: "string",
                description:
                  "Gemini model (gemini-3-pro-image-preview, gemini-2.5-flash-preview-05-20, or gemini-2.0-flash-exp)",
                default: "gemini-3-pro-image-preview",
              },
            },
            required: ["images"],
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

    if (request.params.name === "edit_image") {
      try {
        const args = editImageSchema.parse(request.params.arguments);
        const result = await client.generateImage({
          prompt: args.prompt,
          images: args.images,
          model: args.model,
        });

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
              text: `Failed to edit image: ${message}`,
            },
          ],
        };
      }
    }

    if (request.params.name === "describe_image") {
      try {
        const args = describeImageSchema.parse(request.params.arguments);
        const description = await client.describeImage({
          images: args.images,
          prompt: args.prompt,
          model: args.model,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: description,
            },
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
              text: `Failed to describe image: ${message}`,
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
