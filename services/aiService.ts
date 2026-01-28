import { AiRuntimeConfig, Item } from "../types";
import { getProviderMeta } from "./aiProviders";

type AnalyzeOptions = {
  text?: string;
  imageBase64?: string;
  imageBase64s?: string[];
  categories: string[];
  statuses: string[];
  channels: string[];
  today: string;
  language: 'zh-CN' | 'zh-TW' | 'en' | 'ja';
};

const cleanJsonText = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/```json/gi, "").replace(/```/g, "").trim();
  }
  return trimmed;
};

const safeParse = (raw: string): Partial<Item> => {
  try {
    return JSON.parse(cleanJsonText(raw));
  } catch (error) {
    console.warn("AI JSON parse failed:", error);
    return {};
  }
};

const getLanguageLabel = (lang: AnalyzeOptions['language']) => {
  if (lang === 'zh-CN') return 'Simplified Chinese';
  if (lang === 'zh-TW') return 'Traditional Chinese';
  if (lang === 'ja') return 'Japanese';
  return 'English';
};

const buildPrompt = (options: AnalyzeOptions) => {
  const categoryList = options.categories.join(", ");
  const statusList = options.statuses.join(", ");
  const channelList = options.channels.join(", ");

  return [
    "You are a strict data extraction engine.",
    "Return ONLY valid JSON with these fields: name, price, msrp, purchaseDate, type, category, status, channel, storeName, note.",
    "You may receive multiple images for the same product. Combine evidence across all images.",
    "Rules:",
    `- Note language: ${getLanguageLabel(options.language)}.`,
    "- name: short product name.",
    "- type: 'owned' if already bought/owned, otherwise 'wishlist'.",
    `- purchaseDate: YYYY-MM-DD, default to ${options.today}.`,
    "- price/msrp: numbers, use 0 if missing.",
    `- category: choose the closest from [${categoryList}]. If none fits, use \"other\".`,
    `- status: choose from [${statusList}]. If unknown, use \"new\".`,
    `- channel: choose from [${channelList}] when possible, otherwise empty string.`,
    "- storeName: merchant or shop name, empty if unknown.",
    "- note: concise bullet-style summary in the requested language (<= 20 words), covering key identifiers (name/model/spec), price, channel/store, and date if known. Make it usable to reconstruct the same item later.",
    "Do not include extra keys or explanations."
  ].join("\n");
};


const buildUserText = (text?: string) => {
  if (!text) return "No user text provided.";
  return `User description: ${text}`;
};

const buildChatCompletionsUrl = (rawBaseUrl?: string) => {
  const baseUrl = (rawBaseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return "";
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  return `${baseUrl}/chat/completions`;
};

const buildResponsesUrl = (rawBaseUrl?: string) => {
  const baseUrl = (rawBaseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return "";
  if (baseUrl.endsWith("/responses")) return baseUrl;
  return `${baseUrl}/responses`;
};

const isResponsesEndpoint = (config: AiRuntimeConfig) => {
  const baseUrl = (config.baseUrl || "").toLowerCase();
  return baseUrl.includes("/responses") ;
};

const extractResponsesText = (data: any) => {
  if (typeof data?.output_text === "string") return data.output_text;

  const output = data?.output;
  if (Array.isArray(output)) {
    const texts: string[] = [];
    output.forEach((item: any) => {
      if (typeof item?.text === "string") texts.push(item.text);
      const content = item?.content;
      if (Array.isArray(content)) {
        content.forEach((part: any) => {
          if (typeof part?.text === "string") texts.push(part.text);
          if (typeof part?.output_text === "string") texts.push(part.output_text);
        });
      }
    });
    if (texts.length) return texts.join("");
  }

  const choiceText = data?.choices?.[0]?.message?.content;
  if (typeof choiceText === "string") return choiceText;

  const messageText = data?.message?.content;
  if (typeof messageText === "string") return messageText;

  return "{}";
};

const callOpenAICompatible = async (config: AiRuntimeConfig, prompt: string, options: AnalyzeOptions) => {
  const url = buildChatCompletionsUrl(config.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  const messages: any[] = [
    { role: "system", content: prompt },
  ];

  const images = options.imageBase64s?.length
    ? options.imageBase64s
    : options.imageBase64
      ? [options.imageBase64]
      : [];

  if (images.length > 0) {
    const content = [
      { type: "text", text: buildUserText(options.text) },
      ...images.map((img) => {
        const imageUrl = img.startsWith("data:")
          ? img
          : `data:image/jpeg;base64,${img}`;
        return { type: "image_url", image_url: { url: imageUrl } };
      }),
    ];
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: buildUserText(options.text) });
  }

  const extraBody: Record<string, any> = {};
  if (config.provider === "doubao") {
    extraBody.max_completion_tokens = 65535;
    extraBody.reasoning_effort = "medium";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.2,
      ...extraBody,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  return safeParse(content);
};

const callResponsesApi = async (config: AiRuntimeConfig, prompt: string, options: AnalyzeOptions) => {
  const url = buildResponsesUrl(config.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  const images = options.imageBase64s?.length
    ? options.imageBase64s
    : options.imageBase64
      ? [options.imageBase64]
      : [];

  const content: any[] = [
    { type: "input_text", text: `${prompt}\n\n${buildUserText(options.text)}` }
  ];

  images.forEach((img) => {
    const imageUrl = img.startsWith("data:")
      ? img
      : `data:image/jpeg;base64,${img}`;
    content.push({ type: "input_image", image_url: imageUrl });
  });

  const body: Record<string, any> = {
    model: config.model,
    stream: false,
    input: [
      {
        role: "user",
        content,
      }
    ],
  };

  if (config.model === "deepseek-v3-2-251201") {
    body.tools = [
      {
        type: "web_search",
        max_keyword: 3,
      }
    ];
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const text = extractResponsesText(data);
  return safeParse(text);
};

const callAnthropic = async (config: AiRuntimeConfig, prompt: string, options: AnalyzeOptions) => {
  const baseUrl = config.baseUrl?.replace(/\/$/, "") || "";
  const url = `${baseUrl}/messages`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
    "anthropic-version": "2023-06-01",
  };

  const content: any[] = [{ type: "text", text: buildUserText(options.text) }];
  const images = options.imageBase64s?.length
    ? options.imageBase64s
    : options.imageBase64
      ? [options.imageBase64]
      : [];
  images.forEach((img) => {
    const data = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data,
      },
    });
  });

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      temperature: 0.2,
      system: prompt,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.find((part: any) => part.type === "text")?.text ?? "{}";
  return safeParse(text);
};

const callGemini = async (config: AiRuntimeConfig, prompt: string, options: AnalyzeOptions) => {
  const baseUrl = config.baseUrl?.replace(/\/$/, "") || "";
  const model = config.model || "gemini-2.0-flash";
  const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const parts: any[] = [{ text: prompt }, { text: buildUserText(options.text) }];

  const images = options.imageBase64s?.length
    ? options.imageBase64s
    : options.imageBase64
      ? [options.imageBase64]
      : [];
  images.forEach((img) => {
    const data = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data,
      },
    });
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join("") ?? "{}";
  return safeParse(text);
};

export const analyzeItemDetails = async (
  config: AiRuntimeConfig,
  options: AnalyzeOptions
): Promise<Partial<Item>> => {
  const provider = getProviderMeta(config.provider);
  if (!provider || provider.type === "disabled") {
    throw new Error("AI provider disabled");
  }

  const prompt = buildPrompt(options);

  let data: Partial<Item>;

  if (provider.type === "gemini") {
    data = await callGemini(config, prompt, options);
  } else if (provider.type === "anthropic") {
    data = await callAnthropic(config, prompt, options);
  } else if (provider.type === "openai" && isResponsesEndpoint(config)) {
    data = await callResponsesApi(config, prompt, options);
  } else {
    data = await callOpenAICompatible(config, prompt, options);
  }

  if (data.category && !options.categories.includes(data.category)) {
    data.category = "other";
  }
  if (data.status && !options.statuses.includes(data.status)) {
    data.status = "new";
  }
  if (data.channel && !options.channels.includes(data.channel)) {
    data.channel = "";
  }

  return data;
};

