export type Language = 'zh-CN' | 'zh-TW' | 'en' | 'ja';
export type ThemeColor = 'blue' | 'green' | 'violet' | 'orange' | 'rose';
export type Tab = 'owned' | 'wishlist' | 'profile';
export type CategoryType = 'digital' | 'fashion' | 'home' | 'beauty' | 'books' | 'sports' | 'other';

export interface Item {
  id: string;
  type: 'owned' | 'wishlist';
  name: string;
  price: number;
  msrp: number;
  currency: string;
  purchaseDate: string; // ISO 8601 YYYY-MM-DD
  status: 'new' | 'used' | 'broken' | 'sold';
  category: CategoryType;
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
}