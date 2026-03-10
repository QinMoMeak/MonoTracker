import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Item, AppState } from '../types';

const STORAGE_KEY = 'tracker_data';
const LEGACY_STORAGE_KEY = 'monotracker_data';
const STATE_FILE = 'tracker_state.json';
const IMAGE_DIR = 'item_images';
const IMAGE_KEY_PREFIX = 'tracker_image_';

type PersistedItem = Omit<Item, 'image'>;
type PersistedState = Omit<AppState, 'items'> & {
  items: PersistedItem[];
  imageItemIds?: string[];
};

const stripBom = (value: string) => value.replace(/^\ufeff/, '');

const parseNumber = (value: string) => {
  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseState = (serialized: string): Partial<PersistedState> => {
  try {
    return JSON.parse(serialized);
  } catch (e) {
    console.error('Failed to parse state', e);
    return {};
  }
};

const getImagePath = (id: string) => `${IMAGE_DIR}/${id}.txt`;

const stripImagesFromItems = (items: Item[]) => {
  const imageMap = new Map<string, string>();
  const persistedItems = items.map(item => {
    const { image, ...rest } = item;
    const hasImage = typeof image === 'string' && image.length > 0;
    if (hasImage) {
      imageMap.set(item.id, image);
    }
    return {
      ...rest,
      hasImage
    } as PersistedItem;
  });
  return { persistedItems, imageMap };
};

const hydrateItems = (items: Array<PersistedItem & { image?: string }>) =>
  items.map(item => ({
    ...item,
    image: item.image,
    hasImage: Boolean(item.image || item.hasImage)
  })) as Item[];

const readLocalState = () => {
  const serialized = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!serialized) return {};
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, serialized);
  }
  return parseState(serialized);
};

const writeLocalState = (state: PersistedState, imageMap: Map<string, string>, previousIds: string[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  for (const id of previousIds) {
    if (!imageMap.has(id)) {
      localStorage.removeItem(`${IMAGE_KEY_PREFIX}${id}`);
    }
  }

  imageMap.forEach((image, id) => {
    localStorage.setItem(`${IMAGE_KEY_PREFIX}${id}`, image);
  });
};

const loadFilesystemState = async () => {
  try {
    const result = await Filesystem.readFile({
      path: STATE_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
    const data = typeof result.data === 'string' ? result.data : '';
    return data ? parseState(data) : {};
  } catch (e) {
    console.warn('Failed to load state from filesystem', e);
    return {};
  }
};

const writeFilesystemState = async (state: PersistedState, imageMap: Map<string, string>, previousIds: string[]) => {
  await Filesystem.writeFile({
    path: STATE_FILE,
    data: JSON.stringify(state),
    directory: Directory.Data,
    encoding: Encoding.UTF8
  });

  await Promise.all(previousIds.map(async id => {
    if (imageMap.has(id)) return;
    try {
      await Filesystem.deleteFile({
        path: getImagePath(id),
        directory: Directory.Data
      });
    } catch {
      // Ignore missing old files.
    }
  }));

  await Promise.all(Array.from(imageMap.entries()).map(([id, image]) =>
    Filesystem.writeFile({
      path: getImagePath(id),
      data: image,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true
    })
  ));
};

const getImageIdsFromState = (state: Partial<PersistedState>) =>
  Array.isArray(state.imageItemIds) ? state.imageItemIds.filter(Boolean) : [];

export const loadState = async (): Promise<Partial<AppState>> => {
  let persisted: Partial<PersistedState> = {};

  if (Capacitor.isNativePlatform()) {
    persisted = await loadFilesystemState();
  }

  if (!persisted.items) {
    try {
      persisted = readLocalState();
    } catch (e) {
      console.error('Failed to load state', e);
      persisted = {};
    }
  }

  const items = Array.isArray(persisted.items) ? hydrateItems(persisted.items) : undefined;
  return {
    ...persisted,
    items
  };
};

export const loadItemImage = async (id: string): Promise<string | undefined> => {
  if (!id) return undefined;

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.readFile({
        path: getImagePath(id),
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
      return typeof result.data === 'string' && result.data ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  try {
    return localStorage.getItem(`${IMAGE_KEY_PREFIX}${id}`) || undefined;
  } catch {
    return undefined;
  }
};

export const saveState = async (state: AppState) => {
  const { persistedItems, imageMap } = stripImagesFromItems(state.items);
  const persistedState: PersistedState = {
    ...state,
    items: persistedItems,
    imageItemIds: Array.from(imageMap.keys())
  };

  if (Capacitor.isNativePlatform()) {
    try {
      const previousState = await loadFilesystemState();
      await writeFilesystemState(persistedState, imageMap, getImageIdsFromState(previousState));
    } catch (e) {
      console.error('Failed to save state to filesystem', e);
    }
  }

  try {
    const previousState = readLocalState();
    writeLocalState(persistedState, imageMap, getImageIdsFromState(previousState));
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
