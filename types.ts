
export type Language = 'zh-CN' | 'zh-TW' | 'en' | 'ja';
export type ThemeColor = 'blue' | 'green' | 'violet' | 'orange' | 'rose';
export type AppearanceMode = 'light' | 'dark' | 'system';
export type Tab = 'owned' | 'wishlist' | 'stats' | 'profile';
// CategoryType is now loosely typed to allow custom strings, but keeps specific keys for config lookup
export type CategoryType = 'digital' | 'fashion' | 'home' | 'beauty' | 'books' | 'sports' | 'health' | 'other' | string;
export type AiProvider = 'disabled' | 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'moonshot' | 'qwen' | 'zhipu';

export interface AiCredentials {
  apiKey: string;
  baseUrl?: string;
}

export interface AiConfig {
  provider: AiProvider;
  model: string;
  credentials: Record<string, Record<string, AiCredentials>>;
  lastModelByProvider?: Record<string, string>;
}

export interface AiRuntimeConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface PricePoint {
  date: string; // ISO 8601 YYYY-MM-DD
  price: number;
}

export interface Item {
  id: string;
  type: 'owned' | 'wishlist';
  name: string;
  price: number;
  msrp: number;
  currency: string;
  purchaseDate: string; // ISO 8601 YYYY-MM-DD
  status: 'new' | 'used' | 'broken' | 'sold' | 'emptied' | string; // Relaxed to string for custom
  category: CategoryType;
  channel?: string; // New field for Purchase Channel
  note: string;
  link: string;
  image?: string; // Base64
  usageCount: number; // For manual usage tracking
  discountRate?: number; // Calculated or manual
  priceHistory?: PricePoint[]; // Wishlist price snapshots
  valueDisplay?: 'day' | 'use' | 'both'; // Control which value metrics to show
}

export interface Translations {
  [key: string]: {
    [key in Language]: string;
  };
}

export interface AppState {
  items: Item[];
  language: Language;
  theme: ThemeColor;
  appearance: AppearanceMode;
  aiConfig: AiConfig;
  categories: string[];
  statuses: string[];
  channels: string[];
}

// File System Access API Types
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  createWritable(options?: any): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

// Android Native Bridge Interface
interface AndroidInterface {
  /**
   * Saves CSV content to the device storage via native Android code.
   * @param content The CSV string content
   * @param filename The desired filename (e.g., backup.csv)
   */
  saveCSV: (content: string, filename: string) => void;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
    // Expose the Android interface on the window object
    Android?: AndroidInterface;
  }
}
