import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiImageClient } from "./gemini.js";

describe("GeminiImageClient", () => {
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("constructor", () => {
    it("should create client with valid API key", () => {
      const client = new GeminiImageClient(mockApiKey);
      expect(client).toBeInstanceOf(GeminiImageClient);
    });

    it("should throw error when API key is empty", () => {
      expect(() => new GeminiImageClient("")).toThrow("GEMINI_API_KEY is required");
    });
  });

  describe("generateImage", () => {
    it("should generate image with default options", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: "A beautiful sunset" },
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "base64encodedimage",
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

      const client = new GeminiImageClient(mockApiKey);
      const result = await client.generateImage({ prompt: "a sunset" });

      expect(result).toEqual({
        mimeType: "image/png",
        base64Data: "base64encodedimage",
        description: "A beautiful sunset",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("gemini-3-pro-image-preview:generateContent"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should pass aspect ratio and image size to API for image models", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "base64data",
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

      const client = new GeminiImageClient(mockApiKey);
      await client.generateImage({
        prompt: "a cat",
        aspectRatio: "16:9",
        imageSize: "4K",
        model: "gemini-3-pro-image-preview", // Use image model to test imageConfig
      });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.generationConfig.imageConfig).toEqual({
        aspectRatio: "16:9",
        imageSize: "4K",
      });
    });

    it("should not include imageConfig for non-image models", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "base64data",
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

      const client = new GeminiImageClient(mockApiKey);
      await client.generateImage({
        prompt: "a cat",
        aspectRatio: "16:9", // These should be ignored
        imageSize: "4K",
        model: "gemini-2.0-flash-exp",
      });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);

      expect(body.generationConfig.imageConfig).toBeUndefined();
    });

    it("should throw error on API failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      } as Response);

      const client = new GeminiImageClient(mockApiKey);

      await expect(client.generateImage({ prompt: "test" })).rejects.toThrow(
        "Gemini API error (401): Unauthorized"
      );
    });

    it("should throw error when API returns error object", async () => {
      const mockResponse = {
        error: {
          code: 400,
          message: "Invalid request",
          status: "INVALID_ARGUMENT",
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new GeminiImageClient(mockApiKey);

      await expect(client.generateImage({ prompt: "test" })).rejects.toThrow(
        "Gemini API error: Invalid request"
      );
    });

    it("should throw error when no candidates returned", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      } as Response);

      const client = new GeminiImageClient(mockApiKey);

      await expect(client.generateImage({ prompt: "test" })).rejects.toThrow(
        "No image generated - empty response from Gemini"
      );
    });

    it("should throw error when no image data in response", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Just text, no image" }],
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new GeminiImageClient(mockApiKey);

      await expect(client.generateImage({ prompt: "test" })).rejects.toThrow(
        "No image data in Gemini response"
      );
    });

    it("should handle response without description", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: "imagedata",
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

      const client = new GeminiImageClient(mockApiKey);
      const result = await client.generateImage({ prompt: "test" });

      expect(result).toEqual({
        mimeType: "image/jpeg",
        base64Data: "imagedata",
        description: undefined,
      });
    });
  });
});
