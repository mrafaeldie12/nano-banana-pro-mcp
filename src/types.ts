export interface GeminiImageConfig {
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize?: "1K" | "2K" | "4K";
}

export interface GeminiRequest {
  contents: Array<{
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  }>;
  generationConfig: {
    responseModalities: string[];
    imageConfig?: GeminiImageConfig;
  };
}

export interface GeminiResponsePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: GeminiResponsePart[];
    };
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: GeminiImageConfig["aspectRatio"];
  imageSize?: GeminiImageConfig["imageSize"];
  model?: string;
}

export interface GeneratedImage {
  mimeType: string;
  base64Data: string;
  description?: string;
}
