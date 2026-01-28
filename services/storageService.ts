import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Item, AppState } from '../types';

const STORAGE_KEY = 'tracker_data';
const LEGACY_STORAGE_KEY = 'monotracker_data';
const STATE_FILE = 'tracker_state.json';

const stripBom = (value: string) => value.replace(/^\ufeff/, '');

const parseNumber = (value: string) => {
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseState = (serialized: string): Partial<AppState> => {
  try {
    return JSON.parse(serialized);
  } catch (e) {
    console.error('Failed to parse state', e);
    return {};
  }
};

export const loadState = async (): Promise<Partial<AppState>> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.readFile({
        path: STATE_FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
      const data = typeof result.data === 'string' ? result.data : '';
      if (data) return parseState(data);
    } catch (e) {
      console.warn('Failed to load state from filesystem', e);
    }
  }

  try {
    const serialized = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!serialized) return {};
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
    return parseState(serialized);
  } catch (e) {
    console.error('Failed to load state', e);
    return {};
  }
};

export const saveState = async (state: AppState) => {
  const payload = JSON.stringify(state);

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: STATE_FILE,
        data: payload,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
    } catch (e) {
      console.error('Failed to save state to filesystem', e);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
};

export const exportCSV = (items: Item[]): string => {
  const headers = ['id', 'type', 'name', 'price', 'msrp', 'quantity', 'avgPrice', 'purchaseDate', 'status', 'category', 'channel', 'storeName', 'note', 'usageCount', 'priceHistory'];
  const rows = items.map(item =>
    headers.map(key => {
      let val = (item as any)[key];
      if (key === 'priceHistory') {
        val = Array.isArray(val) ? JSON.stringify(val) : '';
      }
      return `"${String(val || '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

export const importCSV = (csv: string): Item[] => {
  const lines = stripBom(csv).split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const items: Item[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);

    if (values) {
      const item: any = {};
      headers.forEach((h, index) => {
        const val = values[index] ? values[index].replace(/^"|"$/g, '').replace(/""/g, '"') : '';
        if (h === 'price' || h === 'msrp' || h === 'quantity' || h === 'avgPrice' || h === 'usageCount') {
          item[h] = parseNumber(val);
        } else if (h === 'priceHistory') {
          try {
            const parsed = JSON.parse(val);
            item[h] = Array.isArray(parsed) ? parsed : [];
          } catch {
            item[h] = [];
          }
        } else {
          item[h] = val;
        }
      });
      if (!item.id) item.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
      if (!item.image) item.image = undefined;
      if (!item.category) item.category = 'other';
      if (!item.storeName) item.storeName = '';
      if (!item.quantity) item.quantity = 1;
      if (!item.avgPrice) item.avgPrice = item.quantity ? Number((item.price / item.quantity).toFixed(2)) : item.price;
      items.push(item as Item);
    }
  }
  return items;
};
