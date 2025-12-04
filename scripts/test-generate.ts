#!/usr/bin/env npx ts-node --esm

/**
 * Manual test script for the Gemini image generation.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key npx ts-node --esm scripts/test-generate.ts "a cute cat"
 */

import { GeminiImageClient } from "../src/gemini.js";
import { writeFileSync } from "fs";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  const prompt = process.argv[2] || "a beautiful sunset over mountains";
  console.log(`Generating image for: "${prompt}"`);

  const client = new GeminiImageClient(apiKey);

  try {
    // Note: aspectRatio and imageSize only work with image-specific models
    // like gemini-3-pro-image-preview or gemini-2.5-flash-preview-05-20
    const result = await client.generateImage({
      prompt,
    });

    const filename = "test-output.png";
    const buffer = Buffer.from(result.base64Data, "base64");
    writeFileSync(filename, buffer);

    console.log(`✓ Image saved to ${filename}`);
    console.log(`  MIME type: ${result.mimeType}`);
    console.log(`  Size: ${buffer.length} bytes`);
    if (result.description) {
      console.log(`  Description: ${result.description}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
