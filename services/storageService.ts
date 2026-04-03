import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { AppState, Item } from '../types';

const STORAGE_KEY = 'tracker_data';
const LEGACY_STORAGE_KEY = 'monotracker_data';
const PREFERENCES_KEY = 'tracker_preferences';
const STATE_FILE = 'tracker_state.json';
const PREFERENCES_FILE = 'tracker_preferences.json';
const IMAGE_DIR = 'item_images';
const IMAGE_KEY_PREFIX = 'tracker_image_';

type PersistedItem = Omit<Item, 'image'>;
type PersistedState = Omit<AppState, 'items'> & {
  items: PersistedItem[];
  imageItemIds?: string[];
};

type PersistedDataState = Pick<PersistedState, 'items' | 'categories' | 'statuses' | 'channels' | 'imageItemIds'>;
type PersistedPreferencesState = Pick<
  PersistedState,
  'language'
  | 'theme'
  | 'appearance'
  | 'aiConfig'
  | 'webdav'
  | 'autoBackupEnabled'
  | 'lastBackupLocalDate'
  | 'webdavIncludeImages'
  | 'webdavRestoreMode'
>;

type PersistedDataSnapshot = Pick<AppState, 'items' | 'categories' | 'statuses' | 'channels'>;
type PersistedPreferencesSnapshot = Pick<
  AppState,
  'language'
  | 'theme'
  | 'appearance'
  | 'aiConfig'
  | 'webdav'
  | 'autoBackupEnabled'
  | 'lastBackupLocalDate'
  | 'webdavIncludeImages'
  | 'webdavRestoreMode'
>;

type SaveRequest = {
  state: PersistedDataSnapshot;
  imageOverrides: Record<string, string>;
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

const createItemId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}:${hash >>> 0}`;
};

const hydrateItems = (items: Array<PersistedItem & { image?: string }>) =>
  items.map(item => {
    const inlineImage = typeof item.image === 'string' && item.image ? item.image : undefined;
    const thumb = item.imageThumb || inlineImage;
    return {
      ...item,
      image: inlineImage,
      imageThumb: thumb,
      hasImage: Boolean(inlineImage || thumb || item.hasImage)
    } as Item;
  });

const readLocalState = () => {
  const serialized = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!serialized) return {};
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, serialized);
  }
  return parseState(serialized);
};

const readLocalPreferences = () => {
  const serialized = localStorage.getItem(PREFERENCES_KEY);
  if (serialized) {
    return parseState(serialized);
  }

  const legacySerialized = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacySerialized) return {};
  return parseState(legacySerialized);
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

const loadFilesystemPreferences = async () => {
  try {
    const result = await Filesystem.readFile({
      path: PREFERENCES_FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8
    });
    const data = typeof result.data === 'string' ? result.data : '';
    return data ? parseState(data) : {};
  } catch {
    try {
      const result = await Filesystem.readFile({
        path: STATE_FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8
      });
      const data = typeof result.data === 'string' ? result.data : '';
      return data ? parseState(data) : {};
    } catch {
      return {};
    }
  }
};

const writeFilesystemState = async (state: PersistedDataState) => {
  await Filesystem.writeFile({
    path: STATE_FILE,
    data: JSON.stringify(state),
    directory: Directory.Data,
    encoding: Encoding.UTF8
  });
};

const writeFilesystemPreferences = async (state: PersistedPreferencesState) => {
  await Filesystem.writeFile({
    path: PREFERENCES_FILE,
    data: JSON.stringify(state),
    directory: Directory.Data,
    encoding: Encoding.UTF8
  });
};

const getImageIdsFromState = (state: Partial<PersistedState>) => {
  const ids = Array.isArray(state.imageItemIds) ? state.imageItemIds.filter(Boolean) : [];
  if (ids.length > 0) return ids;
  const legacyIds = Array.isArray(state.items)
    ? state.items
        .filter(item => Boolean((item as any)?.hasImage || (item as any)?.image || (item as any)?.imageThumb))
        .map(item => item.id)
        .filter(Boolean)
    : [];
  return Array.from(new Set(legacyIds));
};

let cachedImageIds = new Set<string>();
let cachedImageHashes = new Map<string, string>();
let pendingSaveRequest: SaveRequest | null = null;
let activeSavePromise: Promise<void> | null = null;
let pendingPreferencesRequest: PersistedPreferencesState | null = null;
let activePreferencesPromise: Promise<void> | null = null;

const initializePersistCache = (state: Partial<PersistedState>) => {
  cachedImageIds = new Set(getImageIdsFromState(state));
  cachedImageHashes = new Map();

  if (!Array.isArray(state.items)) return;
  state.items.forEach(item => {
    const image = typeof (item as any)?.image === 'string' ? (item as any).image : undefined;
    if (image && item.id) {
      cachedImageHashes.set(item.id, hashString(image));
    }
  });
};

const buildPersistedState = (state: PersistedDataSnapshot, imageOverrides: Record<string, string>) => {
  const currentImageIds = new Set<string>();
  const upserts = new Map<string, string>();

  const persistedItems = state.items.map(item => {
    const override = item.id ? imageOverrides[item.id] : undefined;
    const inlineImage = typeof item.image === 'string' && item.image ? item.image : undefined;
    const thumb = item.imageThumb || inlineImage || override;
    const imageSource = override || inlineImage || (!cachedImageIds.has(item.id) ? thumb : undefined);
    const hasImage = Boolean(item.hasImage || imageSource || thumb);

    if (hasImage && item.id) {
      currentImageIds.add(item.id);
    }

    if (imageSource && item.id) {
      const nextHash = hashString(imageSource);
      const previousHash = cachedImageHashes.get(item.id);
      if (!cachedImageIds.has(item.id) || previousHash !== nextHash) {
        upserts.set(item.id, imageSource);
      }
    }

    const { image: _image, ...rest } = item;
    return {
      ...rest,
      imageThumb: thumb,
      hasImage
    } as PersistedItem;
  });

  const deletions = Array.from(cachedImageIds).filter(id => !currentImageIds.has(id));
  const persistedState: PersistedDataState = {
    items: persistedItems,
    categories: state.categories,
    statuses: state.statuses,
    channels: state.channels,
    imageItemIds: Array.from(currentImageIds)
  };

  return { persistedState, upserts, deletions, currentImageIds };
};

const applyLocalImageChanges = (upserts: Map<string, string>, deletions: string[]) => {
  deletions.forEach(id => {
    localStorage.removeItem(`${IMAGE_KEY_PREFIX}${id}`);
  });

  upserts.forEach((image, id) => {
    localStorage.setItem(`${IMAGE_KEY_PREFIX}${id}`, image);
  });
};

const applyFilesystemImageChanges = async (upserts: Map<string, string>, deletions: string[]) => {
  await Promise.all(deletions.map(async id => {
    try {
      await Filesystem.deleteFile({
        path: getImagePath(id),
        directory: Directory.Data
      });
    } catch {
      // Ignore missing files.
    }
  }));

  await Promise.all(Array.from(upserts.entries()).map(([id, image]) =>
    Filesystem.writeFile({
      path: getImagePath(id),
      data: image,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true
    })
  ));
};

const commitPersistCache = (
  upserts: Map<string, string>,
  deletions: string[],
  currentImageIds: Set<string>
) => {
  cachedImageIds = new Set(currentImageIds);
  deletions.forEach(id => cachedImageHashes.delete(id));
  upserts.forEach((image, id) => cachedImageHashes.set(id, hashString(image)));
};

const flushSaveQueue = async () => {
  while (pendingSaveRequest) {
    const request = pendingSaveRequest;
    pendingSaveRequest = null;
    const { persistedState, upserts, deletions, currentImageIds } = buildPersistedState(request.state, request.imageOverrides);

    if (Capacitor.isNativePlatform()) {
      try {
        await writeFilesystemState(persistedState);
        await applyFilesystemImageChanges(upserts, deletions);
        commitPersistCache(upserts, deletions, currentImageIds);
        continue;
      } catch (e) {
        console.error('Failed to save state to filesystem', e);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
      applyLocalImageChanges(upserts, deletions);
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }

    commitPersistCache(upserts, deletions, currentImageIds);
  }
};

const flushPreferencesQueue = async () => {
  while (pendingPreferencesRequest) {
    const request = pendingPreferencesRequest;
    pendingPreferencesRequest = null;

    if (Capacitor.isNativePlatform()) {
      try {
        await writeFilesystemPreferences(request);
        continue;
      } catch (e) {
        console.error('Failed to save preferences to filesystem', e);
      }
    }

    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(request));
    } catch (e) {
      console.error('Failed to save preferences to localStorage', e);
    }
  }
};

export const loadState = async (): Promise<Partial<AppState>> => {
  let persisted: Partial<PersistedState> = {};
  let preferences: Partial<PersistedPreferencesState> = {};

  if (Capacitor.isNativePlatform()) {
    persisted = await loadFilesystemState();
    preferences = await loadFilesystemPreferences();
  }

  if (!persisted.items) {
    try {
      persisted = readLocalState();
    } catch (e) {
      console.error('Failed to load state', e);
      persisted = {};
    }
  }

  if (!Object.keys(preferences).length) {
    try {
      preferences = readLocalPreferences();
    } catch (e) {
      console.error('Failed to load preferences', e);
      preferences = {};
    }
  }

  initializePersistCache(persisted);

  const items = Array.isArray(persisted.items) ? hydrateItems(persisted.items) : undefined;
  return {
    ...persisted,
    ...preferences,
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
      const data = typeof result.data === 'string' && result.data ? result.data : undefined;
      if (data) {
        cachedImageIds.add(id);
        cachedImageHashes.set(id, hashString(data));
      }
      return data;
    } catch {
      return undefined;
    }
  }

  try {
    const data = localStorage.getItem(`${IMAGE_KEY_PREFIX}${id}`) || undefined;
    if (data) {
      cachedImageIds.add(id);
      cachedImageHashes.set(id, hashString(data));
    }
    return data;
  } catch {
    return undefined;
  }
};

export const saveState = async (state: PersistedDataSnapshot, imageOverrides: Record<string, string> = {}) => {
  pendingSaveRequest = {
    state: {
      ...state,
      items: state.items.map(item => ({ ...item })),
      categories: [...state.categories],
      statuses: [...state.statuses],
      channels: [...state.channels]
    },
    imageOverrides: { ...imageOverrides }
  };

  if (activeSavePromise) {
    await activeSavePromise;
    return;
  }

  activeSavePromise = flushSaveQueue().finally(() => {
    activeSavePromise = null;
  });

  await activeSavePromise;
};

export const savePreferences = async (state: PersistedPreferencesSnapshot) => {
  pendingPreferencesRequest = {
    ...state,
    aiConfig: JSON.parse(JSON.stringify(state.aiConfig)),
    webdav: { ...state.webdav }
  };

  if (activePreferencesPromise) {
    await activePreferencesPromise;
    return;
  }

  activePreferencesPromise = flushPreferencesQueue().finally(() => {
    activePreferencesPromise = null;
  });

  await activePreferencesPromise;
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
      if (!item.id) item.id = createItemId();
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
