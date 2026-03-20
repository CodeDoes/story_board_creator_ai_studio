import { GoogleGenAI } from "@google/genai";
import { withRetry } from "./apiUtils";
import { GenerationResult } from "../types";
import { getApiKey } from "./auth";

export const generateProductionAsset = async (
  prompt: string, 
  referenceImages: string[], 
  size: "1K" | "2K" | "512px" = "1K", 
  layoutRef?: string,
  model: string = "gemini-3.1-flash-image-preview",
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9",
  promptParts?: { imagePrompt?: string; stylePrompt?: string; contextPrompt?: string }
): Promise<GenerationResult> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API key not found. Please set your Gemini API key.");
  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [{ text: prompt }];
  referenceImages.forEach(img => {
    parts.push({
      inlineData: {
        data: img.split(',')[1],
        mimeType: "image/png"
      }
    });
  });

  if (layoutRef) {
    parts.push({
      inlineData: {
        data: layoutRef.split(',')[1],
        mimeType: "image/png"
      }
    });
    parts.push({ text: "CRITICAL: Use the provided layout reference as a spatial guide for composition. Match the framing and object placement exactly." });
  }

  const response = await withRetry(() => ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio,
        imageSize: size === "512px" ? "512px" : size
      }
    }
  }));

  let image = "";
  let feedback = "Generation complete.";

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      image = `data:image/png;base64,${part.inlineData.data}`;
    } else if (part.text) {
      feedback = part.text;
    }
  }

  if (!image) throw new Error("No image returned from engine.");

  return {
    image,
    feedback,
    timestamp: Date.now(),
    settings: { 
      prompt, 
      size, 
      hasLayoutRef: !!layoutRef,
      ...promptParts
    }
  };
};
