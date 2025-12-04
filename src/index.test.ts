import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "./index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

// Valid base64 string for testing (1x1 transparent PNG)
const VALID_BASE64_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("MCP Server", () => {
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function createTestClient() {
    const server = createServer(mockApiKey);
    const client = new Client({ name: "test-client", version: "1.0.0" });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    return { client, server };
  }

  describe("listTools", () => {
    it("should list all three image tools", async () => {
      const { client } = await createTestClient();
      const result = await client.listTools();

      expect(result.tools).toHaveLength(3);
      expect(result.tools[0].name).toBe("generate_image");
      expect(result.tools[0].description).toContain("Google Gemini");
      expect(result.tools[0].inputSchema.required).toContain("prompt");
      expect(result.tools[1].name).toBe("edit_image");
      expect(result.tools[1].description).toContain("Edit");
      expect(result.tools[1].inputSchema.required).toContain("images");
      expect(result.tools[2].name).toBe("describe_image");
      expect(result.tools[2].description).toContain("Analyze");
      expect(result.tools[2].inputSchema.required).toContain("images");
    });

    it("should have correct input schema for generate_image", async () => {
      const { client } = await createTestClient();
      const result = await client.listTools();

      const tool = result.tools[0];
      const properties = tool.inputSchema.properties as Record<string, unknown>;

      expect(properties.prompt).toBeDefined();
      expect(properties.aspectRatio).toBeDefined();
      expect(properties.imageSize).toBeDefined();
      expect(properties.images).toBeDefined();
    });

    it("should have correct input schema for edit_image", async () => {
      const { client } = await createTestClient();
      const result = await client.listTools();

      const tool = result.tools[1];
      const properties = tool.inputSchema.properties as Record<string, unknown>;

      expect(properties.prompt).toBeDefined();
      expect(properties.images).toBeDefined();
      expect(properties.model).toBeDefined();
    });
  });

  describe("callTool - generate_image", () => {
    it("should generate image successfully", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: "A majestic mountain" },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: VALID_BASE64_PNG,
                  },
                },
              ],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "generate_image",
        arguments: { prompt: "a mountain landscape" },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: "image",
        data: VALID_BASE64_PNG,
        mimeType: "image/png",
      });
      expect(result.content[1]).toEqual({
        type: "text",
        text: "A majestic mountain",
      });
    });

    it("should handle image generation without description", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: VALID_BASE64_PNG,
                  },
                },
              ],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "generate_image",
        arguments: { prompt: "abstract art" },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "image",
        data: VALID_BASE64_PNG,
        mimeType: "image/png",
      });
    });

    it("should pass custom aspect ratio and size for image models", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: VALID_BASE64_PNG,
                  },
                },
              ],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      await client.callTool({
        name: "generate_image",
        arguments: {
          prompt: "panorama",
          aspectRatio: "16:9",
          imageSize: "4K",
          model: "gemini-3-pro-image-preview", // Use image model
        },
      });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.generationConfig.imageConfig).toEqual({
        aspectRatio: "16:9",
        imageSize: "4K",
      });
    });

    it("should return error on API failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "generate_image",
        arguments: { prompt: "test" },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Failed to generate image"),
      });
    });

    it("should return error for invalid prompt type", async () => {
      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "generate_image",
        arguments: { prompt: 123 }, // Invalid type
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Failed to generate image"),
      });
    });
  });

  describe("callTool - generate_image with reference images", () => {
    it("should generate image with reference images", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: VALID_BASE64_PNG,
                  },
                },
              ],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "generate_image",
        arguments: {
          prompt: "Generate in this style",
          images: [
            { data: VALID_BASE64_PNG, mimeType: "image/png" },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]).toEqual({
        type: "image",
        data: VALID_BASE64_PNG,
        mimeType: "image/png",
      });

      // Verify images were sent in request
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.contents[0].parts).toHaveLength(2);
      expect(body.contents[0].parts[1].inlineData).toBeDefined();
    });
  });

  describe("callTool - edit_image", () => {
    it("should edit image successfully", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: "Edited image" },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: VALID_BASE64_PNG,
                  },
                },
              ],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "edit_image",
        arguments: {
          prompt: "Add sunglasses to this image",
          images: [
            { data: VALID_BASE64_PNG, mimeType: "image/png" },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: "image",
        data: VALID_BASE64_PNG,
        mimeType: "image/png",
      });
    });

    it("should edit with multiple images", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: VALID_BASE64_PNG,
                  },
                },
              ],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "edit_image",
        arguments: {
          prompt: "Combine these images",
          images: [
            { data: VALID_BASE64_PNG, mimeType: "image/png" },
            { data: VALID_BASE64_PNG, mimeType: "image/jpeg" },
          ],
        },
      });

      expect(result.isError).toBeFalsy();

      // Verify multiple images were sent
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.contents[0].parts).toHaveLength(3); // prompt + 2 images
    });

    it("should return error when no images provided to edit_image", async () => {
      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "edit_image",
        arguments: {
          prompt: "Edit this",
          images: [], // Empty array
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Failed to edit image"),
      });
    });

    it("should return error on API failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "edit_image",
        arguments: {
          prompt: "Edit this",
          images: [{ data: VALID_BASE64_PNG, mimeType: "image/png" }],
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Failed to edit image"),
      });
    });
  });

  describe("callTool - describe_image", () => {
    it("should describe image successfully", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "A cute orange crab holding a banana phone" }],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "describe_image",
        arguments: {
          images: [{ data: VALID_BASE64_PNG, mimeType: "image/png" }],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: "text",
        text: "A cute orange crab holding a banana phone",
      });
    });

    it("should describe image with custom prompt", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "There are 3 objects" }],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "describe_image",
        arguments: {
          images: [{ data: VALID_BASE64_PNG, mimeType: "image/png" }],
          prompt: "How many objects are in this image?",
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: "There are 3 objects",
      });

      // Verify custom prompt was sent
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.contents[0].parts[0].text).toBe("How many objects are in this image?");
    });

    it("should return error when no images provided", async () => {
      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "describe_image",
        arguments: {
          images: [],
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Failed to describe image"),
      });
    });

    it("should return error on API failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response);

      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "describe_image",
        arguments: {
          images: [{ data: VALID_BASE64_PNG, mimeType: "image/png" }],
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: expect.stringContaining("Failed to describe image"),
      });
    });
  });

  describe("callTool - unknown tool", () => {
    it("should return error for unknown tool", async () => {
      const { client } = await createTestClient();
      const result = await client.callTool({
        name: "unknown_tool",
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        type: "text",
        text: "Unknown tool: unknown_tool",
      });
    });
  });
});
