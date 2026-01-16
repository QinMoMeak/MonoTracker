
import { GoogleGenAI, Type } from "@google/genai";
import { Item } from "../types";

const extractItemDetails = async (
  text: string,
  imageBase64?: string
): Promise<Partial<Item>> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    throw new Error("API Key is missing. Cannot perform AI analysis.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Schema definition for strictly typed JSON output
  const itemSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Name of the product or item" },
      price: { type: Type.NUMBER, description: "Purchase price" },
      msrp: { type: Type.NUMBER, description: "Original market price or MSRP" },
      purchaseDate: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
      type: { type: Type.STRING, enum: ["owned", "wishlist"], description: "Whether the user already owns it or wants it" },
      category: { 
          type: Type.STRING, 
          // Suggest standard categories but allow AI to infer if it fits strictly, 
          // though our prompt will encourage standard keys. 
          // We list "health" now.
          description: "Category keys: digital, fashion, home, beauty, books, sports, health, other. Or a custom string if it doesn't fit." 
      },
      channel: { type: Type.STRING, description: "Purchase channel/store (e.g. JD, Taobao, Pinduoduo, Xianyu, Douyin) or user specified" },
      note: { type: Type.STRING, description: "A short description or summary" },
      status: { type: Type.STRING, description: "Condition: new, used, broken, sold, emptied. Or custom." },
    },
    required: ["name", "type"],
  };

  const prompt = `
    Analyze the provided input (text and/or image) and extract product information.
    If the user mentions they bought it, set type to 'owned'. If they want it, set to 'wishlist'.
    Classify the item into one of the following categories if possible: digital, fashion, home, beauty, books, sports, health, other.
    If no currency is specified, assume the local number.
    Extract the purchase channel (e.g., JD, Taobao, etc.) if mentioned.
    If no date is specified, use today's date: ${new Date().toISOString().split('T')[0]}.
    Return JSON only.
  `;

  try {
    const parts: any[] = [{ text: prompt }];

    // If image exists, add it to the parts
    if (imageBase64) {
      // Remove data URL prefix if present for clean base64
      const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64,
        },
      });
      parts.push({ text: "\nAlso analyze the image for product details." });
    }

    if (text) {
      parts.push({ text: `\nUser Description: ${text}` });
    }

    // Use gemini-2.5-flash-image if image is present, otherwise gemini-3-flash-preview for text speed
    const modelName = imageBase64 ? 'gemini-2.5-flash-image' : 'gemini-3-flash-preview';

    let config: any = {
       temperature: 0.2,
    };

    if (modelName === 'gemini-3-flash-preview') {
        config.responseMimeType = "application/json";
        config.responseSchema = itemSchema;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: config
    });

    let jsonString = response.text || "{}";
    
    // Clean markdown code blocks if present (common in 2.5 models without strict schema)
    if (jsonString.includes("```json")) {
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "");
    }

    try {
        const data = JSON.parse(jsonString);
        // Default category if AI fails to guess properly or returns undefined
        if (!data.category) data.category = 'other';
        return data;
    } catch (e) {
        console.error("Failed to parse JSON", e);
        return {};
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export { extractItemDetails };
