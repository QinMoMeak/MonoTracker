import { AiProvider } from "../types";

export type AiProviderType = "disabled" | "openai" | "anthropic" | "gemini";

export interface AiProviderModel {
  id: string;
  label: string;
  defaultBaseUrl?: string;
}

export interface AiProviderMeta {
  id: AiProvider;
  type: AiProviderType;
  labelKey: string;
  defaultModel: string;
  models: AiProviderModel[];
  defaultBaseUrl?: string;
  supportsVision?: boolean;
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  { id: "disabled", type: "disabled", labelKey: "aiDisabled", defaultModel: "", models: [] },
  { 
    id: "openai",
    type: "openai",
    labelKey: "aiOpenAI",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportsVision: true,
    models: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini" },
      { id: "gpt-4o", label: "gpt-4o" },
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
      { id: "gpt-4.1", label: "gpt-4.1" }
    ]
  },
  { 
    id: "gemini",
    type: "gemini",
    labelKey: "aiGemini",
    defaultModel: "gemini-2.0-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    supportsVision: true,
    models: [
      { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
      { id: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite" },
      { id: "gemini-2.0-pro", label: "gemini-2.0-pro" }
    ]
  },
  { 
    id: "anthropic",
    type: "anthropic",
    labelKey: "aiAnthropic",
    defaultModel: "claude-3-5-sonnet-20241022",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    supportsVision: true,
    models: [
      { id: "claude-3-5-sonnet-20241022", label: "claude-3.5-sonnet" },
      { id: "claude-3-5-haiku-20241022", label: "claude-3.5-haiku" },
      { id: "claude-3-opus-20240229", label: "claude-3-opus" }
    ]
  },
  { 
    id: "deepseek",
    type: "openai",
    labelKey: "aiDeepSeek",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", label: "deepseek-chat" },
      { id: "deepseek-reasoner", label: "deepseek-reasoner" }
    ]
  },
  { 
    id: "moonshot",
    type: "openai",
    labelKey: "aiMoonshot",
    defaultModel: "moonshot-v1-8k",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    models: [
      { id: "moonshot-v1-8k", label: "moonshot-v1-8k" },
      { id: "moonshot-v1-32k", label: "moonshot-v1-32k" },
      { id: "moonshot-v1-128k", label: "moonshot-v1-128k" }
    ]
  },
  { 
    id: "qwen",
    type: "openai",
    labelKey: "aiQwen",
    defaultModel: "qwen-turbo",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-turbo", label: "qwen-turbo" },
      { id: "qwen-plus", label: "qwen-plus" },
      { id: "qwen-max", label: "qwen-max" }
    ]
  },
  { 
    id: "zhipu",
    type: "openai",
    labelKey: "aiZhipu",
    defaultModel: "glm-4.6v-flash",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    models: [
      { id: "glm-4.6v-flash", label: "glm-4.6v-flash", defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions" }
    ]
  },
];

export const getProviderMeta = (provider: AiProvider): AiProviderMeta | undefined =>
  AI_PROVIDERS.find(p => p.id === provider);

export const getProviderModels = (provider: AiProvider): AiProviderModel[] =>
  getProviderMeta(provider)?.models || [];

export const getModelMeta = (provider: AiProvider, model: string): AiProviderModel | undefined =>
  getProviderModels(provider).find(m => m.id === model);
