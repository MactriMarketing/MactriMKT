import { GoogleGenAI } from "@google/genai";
import { AspectRatio } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Sends an image and a prompt to Gemini to edit the image.
 * @param imageBase64 The base64 string of the image (raw data, no prefix).
 * @param mimeType The mime type of the image (e.g., image/jpeg).
 * @param promptDescription Description of the edit or new background.
 * @param mode The editing mode ('background', 'custom', or 'banner').
 * @param isHighQuality Whether to use the high-quality model (2K resolution).
 * @param focusOnProduct Whether to enhance product details and sharpness.
 * @param aspectRatio The desired output aspect ratio.
 */
export const generateEditedImage = async (
  imageBase64: string,
  mimeType: string,
  promptDescription: string,
  mode: 'background' | 'custom' | 'banner',
  isHighQuality: boolean = false,
  focusOnProduct: boolean = false,
  aspectRatio: AspectRatio = '1:1'
): Promise<string> => {
  const ai = getAiClient();
  
  // Select model based on quality preference
  // Gemini 3 Pro is required for 2K output
  const model = isHighQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

  // Construct Prompt
  let prompt = "";
  
  if (mode === 'background') {
    prompt = `Change the background of this image to: ${promptDescription}. `;
  } else if (mode === 'banner') {
    // Specialized prompt for Advertising Banners
    prompt = `Create a high-converting professional advertising banner featuring this product. 
    Context/Theme: ${promptDescription}. 
    CRITICAL COMPOSITION RULE: Place the product elegantly to one side or bottom-center to create clear NEGATIVE SPACE (Copy Space) for marketing text overlay. 
    Background should be distinct but not distracting. `;
  } else {
    // Custom mode
    prompt = `${promptDescription}. `;
  }

  // Enhanced prompt logic
  if (focusOnProduct || mode === 'banner') {
    // Banners always default to focusing on the product
    prompt += " The foreground object is a commercial product. PRESERVE the product details exactly. Sharpen the product focus, enhance textures, and ensure high fidelity. Use professional studio lighting to highlight the product. ";
  } else if (mode === 'background') {
    prompt += " Keep the main subject intact and realistic. ";
  } else {
    prompt += " Maintain high coherence and photorealism. ";
  }

  if (isHighQuality) {
    prompt += " Output in 2K resolution (2048x2048), hyper-realistic, extremely detailed, sharp focus, 8k photography.";
  } else {
    prompt += " High quality, photorealistic, commercial photography standard.";
  }

  // Configure Image Config
  const config: any = {
    imageConfig: {
      aspectRatio: aspectRatio
    }
  };

  if (isHighQuality) {
    config.imageConfig.imageSize = '2K';
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: config
    });

    // Extract the image from the response
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image generated in the response.");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};