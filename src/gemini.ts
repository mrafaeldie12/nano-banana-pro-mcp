import type {
  GeminiRequest,
  GeminiResponse,
  GenerateImageOptions,
  GeneratedImage,
  DescribeImageOptions,
} from "./types.js";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Allowed models for image generation
const ALLOWED_MODELS = [
  "gemini-3-pro-image-preview",    // Nano Banana Pro (highest quality)
  "gemini-2.5-flash-preview-05-20", // Nano Banana (fast)
  "gemini-2.0-flash-exp",           // Widely available fallback
] as const;

const DEFAULT_MODEL = "gemini-3-pro-image-preview";

export class GeminiImageClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  async generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
    const { prompt, aspectRatio, imageSize, images } = options;
    const model = options.model || DEFAULT_MODEL;

    // Validate model against allowlist to prevent URL manipulation
    if (!ALLOWED_MODELS.includes(model as typeof ALLOWED_MODELS[number])) {
      throw new Error(
        `Invalid model: ${model}. Allowed: ${ALLOWED_MODELS.join(", ")}`
      );
    }

    // Only certain models support imageConfig (aspect ratio, size)
    const supportsImageConfig = model.includes("image") || model.includes("imagen");

    // Build request parts array: text prompt + optional input images
    const requestParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt }
    ];

    // Add input images if provided (for reference or editing)
    if (images && images.length > 0) {
      for (const img of images) {
        requestParts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        });
      }
    }

    const requestBody: GeminiRequest = {
      contents: [
        {
          parts: requestParts,
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(supportsImageConfig && (aspectRatio || imageSize)
          ? {
              imageConfig: {
                ...(aspectRatio && { aspectRatio }),
                ...(imageSize && { imageSize }),
              },
            }
          : {}),
      },
    };
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No image generated - empty response from Gemini");
    }

    const responseParts = data.candidates[0].content.parts;
    let imageData: GeneratedImage | null = null;
    let description: string | undefined;

    for (const part of responseParts) {
      if ("inlineData" in part && part.inlineData) {
        imageData = {
          mimeType: part.inlineData.mimeType,
          base64Data: part.inlineData.data,
        };
      } else if ("text" in part && part.text) {
        description = part.text;
      }
    }

    if (!imageData) {
      throw new Error("No image data in Gemini response");
    }

    return {
      ...imageData,
      description,
    };
  }

  async describeImage(options: DescribeImageOptions): Promise<string> {
    const { images, prompt } = options;
    const model = options.model || DEFAULT_MODEL;

    // Validate model against allowlist to prevent URL manipulation
    if (!ALLOWED_MODELS.includes(model as typeof ALLOWED_MODELS[number])) {
      throw new Error(
        `Invalid model: ${model}. Allowed: ${ALLOWED_MODELS.join(", ")}`
      );
    }

    if (!images || images.length === 0) {
      throw new Error("At least one image is required");
    }

    // Build request parts: prompt + images
    const defaultPrompt = "Describe this image in detail. What do you see?";
    const requestParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt || defaultPrompt }
    ];

    for (const img of images) {
      requestParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
        },
      });
    }

    const requestBody: GeminiRequest = {
      contents: [
        {
          parts: requestParts,
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT"],  // Text only, no image output
      },
    };

    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini");
    }

    const responseParts = data.candidates[0].content.parts;
    let description = "";

    for (const part of responseParts) {
      if ("text" in part && part.text) {
        description += part.text;
      }
    }

    if (!description) {
      throw new Error("No description in Gemini response");
    }

    return description;
  }
}
