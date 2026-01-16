
export type Language = 'zh-CN' | 'zh-TW' | 'en' | 'ja';
export type ThemeColor = 'blue' | 'green' | 'violet' | 'orange' | 'rose';
export type AppearanceMode = 'light' | 'dark' | 'system';
export type Tab = 'owned' | 'wishlist' | 'profile';
// CategoryType is now loosely typed to allow custom strings, but keeps specific keys for config lookup
export type CategoryType = 'digital' | 'fashion' | 'home' | 'beauty' | 'books' | 'sports' | 'health' | 'other' | string;

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
  showAiFab: boolean;
  customCategories: string[];
  customChannels: string[];
}
