import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy, useTransition } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { AiConfig, AiCredentials, AiProvider, AiRuntimeConfig, Item, Language, ThemeColor, Tab, AppearanceMode, WebDavConfig, RestoreMode } from './types';
import { THEMES, TEXTS, ICONS, INITIAL_ITEMS, CATEGORY_CONFIG, DEFAULT_CHANNELS, DEFAULT_STATUSES } from './constants';
import { loadItemImage, loadState, savePreferences, saveState, exportCSV } from './services/storageService';
import { buildExportZip, importBackupFile } from './services/backupService';
import { deleteWebDav, downloadWebDav, existsWebDav, uploadWebDav } from './services/webdavService';
import { AI_PROVIDERS, getModelMeta, getProviderMeta, getProviderModels } from './services/aiProviders';
import { formatCurrency } from './utils/format';
import { useDebouncedPersist } from './hooks/useDebouncedPersist';
import OwnedTabContainer from './components/OwnedTabContainer';
import WishlistTabContainer from './components/WishlistTabContainer';
import StatsTabContainer from './components/StatsTabContainer';
import TabErrorBoundary from './components/TabErrorBoundary';
const AddItemModal = lazy(() => import('./components/AddItemModal'));
const Dialog = lazy(() => import('./components/Dialog'));
const SheetModal = lazy(() => import('./components/SheetModal'));

const App: React.FC = () => {
  // --- State ---
  const [items, setItems] = useState<Item[]>([]);
  const [language, setLanguage] = useState<Language>('zh-CN');
  const [theme, setTheme] = useState<ThemeColor>('blue');
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [activeTab, setActiveTab] = useState<Tab>('owned');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [initialAddMode, setInitialAddMode] = useState<'ai' | 'manual'>('ai');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>({ provider: 'disabled', model: '', credentials: {} });
  const [showAiSettingsModal, setShowAiSettingsModal] = useState(false);
  const [showQuickStartModal, setShowQuickStartModal] = useState(false);
  const [showDataManageModal, setShowDataManageModal] = useState(false);
  const [showWebdavModal, setShowWebdavModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; name?: string } | null>(null);
  
  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState('');

  // Managed Data State
  const [categories, setCategories] = useState<string[]>(Object.keys(CATEGORY_CONFIG));
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [channels, setChannels] = useState<string[]>(DEFAULT_CHANNELS);
  const [webdavConfig, setWebdavConfig] = useState<WebDavConfig>({
    serverUrl: 'https://dav.jianguoyun.com/dav/',
    username: '',
    password: ''
  });
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [webdavIncludeImages, setWebdavIncludeImages] = useState(false);
  const [webdavRestoreMode, setWebdavRestoreMode] = useState<RestoreMode>('merge');
  const [lastBackupLocalDate, setLastBackupLocalDate] = useState('');
  const [webdavHistory, setWebdavHistory] = useState<WebDavManifestEntry[]>([]);
  const [webdavHistoryLoading, setWebdavHistoryLoading] = useState(false);
  const [selectedWebdavBackupId, setSelectedWebdavBackupId] = useState('');
  const itemImagesRef = useRef<Record<string, string>>({});
  const imageCacheOrderRef = useRef<string[]>([]);
  const pendingImageLoadsRef = useRef<Map<string, Promise<string | undefined>>>(new Map());
  const transientUrlTimeoutsRef = useRef<number[]>([]);
  const appMountedRef = useRef(true);
  const isHandlingBackRef = useRef(false);
  const imageLoadQueueRef = useRef<Array<() => void>>([]);
  const activeImageLoadCountRef = useRef(0);
  const [mountedTabs, setMountedTabs] = useState({ owned: true, wishlist: false, stats: false });
  const [, startUiTransition] = useTransition();

  type DialogState = {
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message?: string;
    confirmText: string;
    cancelText?: string;
    defaultValue?: string;
    placeholder?: string;
    onConfirm: (value?: string) => void;
    onCancel?: () => void;
  };

  const [dialog, setDialog] = useState<DialogState | null>(null);

  const mergeUnique = (values: string[]) =>
    Array.from(new Set(values.map(v => v.trim()).filter(Boolean)));

  const t = (key: string, fallback: string = key) =>
    (TEXTS as any)?.[key]?.[language]
    ?? (TEXTS as any)?.[key]?.['zh-CN']
    ?? (TEXTS as any)?.[key]?.['en']
    ?? fallback;

  const MAX_IMAGE_CACHE = 96;

  const touchCachedImage = useCallback((id: string, image: string) => {
    if (!id || !image) return;
    itemImagesRef.current[id] = image;
    const nextOrder = imageCacheOrderRef.current.filter(entryId => entryId !== id);
    nextOrder.push(id);

    while (nextOrder.length > MAX_IMAGE_CACHE) {
      const evictedId = nextOrder.shift();
      if (evictedId) {
        delete itemImagesRef.current[evictedId];
      }
    }

    imageCacheOrderRef.current = nextOrder;
  }, []);

  const dropCachedImage = useCallback((id: string) => {
    delete itemImagesRef.current[id];
    imageCacheOrderRef.current = imageCacheOrderRef.current.filter(entryId => entryId !== id);
  }, []);

  const WEBDAV_BACKUP_ROOT = 'TrackerBackups';
  const WEBDAV_SNAPSHOTS_DIR = `${WEBDAV_BACKUP_ROOT}/snapshots`;
  const WEBDAV_STAGING_DIR = `${WEBDAV_BACKUP_ROOT}/staging`;
  const WEBDAV_MANIFEST = `${WEBDAV_BACKUP_ROOT}/manifest.json`;
  const WEBDAV_MANIFEST_TMP = `${WEBDAV_BACKUP_ROOT}/manifest.json.tmp`;

  type WebDavManifestEntry = {
    id: string;
    zipPath: string;
    readyPath: string;
    sha256: string;
    size: number;
    createdAt: string;
  };

  type WebDavManifest = {
    schemaVersion: 1;
    history: WebDavManifestEntry[];
  };

  const buildBackupId = () => {
    const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    return iso.replace(/:/g, '-');
  };

  const sha256Blob = async (blob: Blob) => {
    if (!globalThis.crypto?.subtle?.digest) return '';
    const buffer = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  const getLocalDateKey = () => {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const normalizeManifestHistory = (entries: WebDavManifestEntry[]) => {
    const seen = new Set<string>();
    return entries
      .filter(Boolean)
      .filter(entry => {
        if (!entry?.id || !entry?.zipPath || !entry?.readyPath) return false;
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      });
  };

  const normalizeManifest = (raw: any): WebDavManifest | null => {
    if (!raw || raw.schemaVersion !== 1) return null;
    if (Array.isArray(raw.history)) {
      return { schemaVersion: 1, history: normalizeManifestHistory(raw.history) };
    }
    const legacyHistory = [raw.current, raw.previous].filter(Boolean);
    if (legacyHistory.length) {
      return { schemaVersion: 1, history: normalizeManifestHistory(legacyHistory) };
    }
    return { schemaVersion: 1, history: [] };
  };

  const readWebDavManifest = async (config: WebDavConfig): Promise<WebDavManifest | null> => {
    try {
      const blob = await downloadWebDav(config, WEBDAV_MANIFEST);
      const raw = await blob.text();
      const parsed = JSON.parse(raw);
      return normalizeManifest(parsed);
    } catch {
      return null;
    }
  };

  const writeWebDavManifest = async (config: WebDavConfig, manifest: WebDavManifest) => {
    const content = JSON.stringify(manifest, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    try {
      await uploadWebDav(config, WEBDAV_MANIFEST_TMP, blob);
    } catch (e) {
      console.warn('WebDAV manifest tmp upload failed:', e);
    }
    await uploadWebDav(config, WEBDAV_MANIFEST, blob);
  };

  const createSnapshotEntry = async (zipBlob: Blob, id: string): Promise<WebDavManifestEntry> => {
    const zipName = `${id}_full.zip`;
    const zipPath = `${WEBDAV_SNAPSHOTS_DIR}/${zipName}`;
    const readyPath = `${WEBDAV_SNAPSHOTS_DIR}/${zipName}.ready`;
    const sha256 = await sha256Blob(zipBlob);
    return {
      id,
      zipPath,
      readyPath,
      sha256,
      size: zipBlob.size,
      createdAt: new Date().toISOString()
    };
  };

  const uploadSnapshot = async (config: WebDavConfig, entry: WebDavManifestEntry, zipBlob: Blob) => {
    const zipName = entry.zipPath.split('/').pop() || `${entry.id}_full.zip`;
    const partPath = `${WEBDAV_STAGING_DIR}/${zipName}.part`;
    await uploadWebDav(config, partPath, zipBlob);
    await uploadWebDav(config, entry.zipPath, zipBlob);
    const readyBlob = new Blob(['ready'], { type: 'text/plain' });
    await uploadWebDav(config, entry.readyPath, readyBlob);
  };

  const trimHistory = (history: WebDavManifestEntry[], limit: number) => ({
    keep: history.slice(0, limit),
    remove: history.slice(limit)
  });

  const cleanupSnapshots = async (config: WebDavConfig, entries: WebDavManifestEntry[]) => {
    if (!entries.length) return;
    await Promise.all(entries.map(async (entry) => {
      await deleteWebDav(config, entry.zipPath).catch(e => console.warn('WebDAV delete zip failed:', e));
      await deleteWebDav(config, entry.readyPath).catch(e => console.warn('WebDAV delete ready failed:', e));
    }));
  };

  const commitSnapshot = async (config: WebDavConfig, entry: WebDavManifestEntry, zipBlob: Blob) => {
    await uploadSnapshot(config, entry, zipBlob);
    const manifest = await readWebDavManifest(config);
    const merged = normalizeManifestHistory([entry, ...(manifest?.history || [])]);
    const { keep, remove } = trimHistory(merged, 4);
    await writeWebDavManifest(config, { schemaVersion: 1, history: keep });
    await cleanupSnapshots(config, remove);
    return keep;
  };

  const shouldCommitBackup = (dataCount: number) => dataCount > 0;

  const tryRestoreSnapshot = async (config: WebDavConfig, entry: WebDavManifestEntry | undefined, mode: RestoreMode = 'merge') => {
    if (!entry) return false;
    try {
      const ready = await existsWebDav(config, entry.readyPath);
      if (!ready) return false;
      const zipBlob = await downloadWebDav(config, entry.zipPath);
      if (entry.size && zipBlob.size !== entry.size) {
        throw new Error(`Backup size mismatch: ${zipBlob.size} != ${entry.size}`);
      }
      if (entry.sha256) {
        const hash = await sha256Blob(zipBlob);
        if (hash && hash !== entry.sha256) {
          throw new Error('Backup hash mismatch');
        }
      }
      const file = new File([zipBlob], entry.zipPath.split('/').pop() || 'backup.zip', { type: 'application/zip' });
      const newItems = await importBackupFile(file);
      if (!appMountedRef.current) return false;
      if (mode === 'overwrite') {
        const normalized = newItems.map(raw => prepareItemForState(raw as Item, { cacheImage: true }));
        setItems(normalized);
      } else {
        setItems(prev => mergeImportedItems(prev, newItems));
      }
      return true;
    } catch (e) {
      console.warn('WebDAV restore failed:', e);
      return false;
    }
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const formatBackupLabel = (entry: WebDavManifestEntry) => {
    const parsed = entry.createdAt ? new Date(entry.createdAt) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
    return entry.id;
  };

  const webdavHistoryRequestRef = useRef(0);

  const fetchWebDavHistory = async (config: WebDavConfig) => {
    const manifest = await readWebDavManifest(config);
    const history = manifest?.history || [];
    const readyChecks = await Promise.all(history.map(async (entry) => {
      const ready = await existsWebDav(config, entry.readyPath).catch(() => false);
      return ready ? entry : null;
    }));
    return readyChecks.filter(Boolean) as WebDavManifestEntry[];
  };

  const refreshWebDavHistory = useCallback(async () => {
    const requestId = webdavHistoryRequestRef.current + 1;
    webdavHistoryRequestRef.current = requestId;
    const { serverUrl, username, password } = webdavConfig;
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      if (appMountedRef.current && webdavHistoryRequestRef.current === requestId) {
        setWebdavHistory([]);
        setSelectedWebdavBackupId('');
        setWebdavHistoryLoading(false);
      }
      return [];
    }
    if (!Capacitor.isNativePlatform()) {
      if (appMountedRef.current && webdavHistoryRequestRef.current === requestId) {
        setWebdavHistory([]);
        setSelectedWebdavBackupId('');
        setWebdavHistoryLoading(false);
      }
      return [];
    }
    if (appMountedRef.current && webdavHistoryRequestRef.current === requestId) {
      setWebdavHistoryLoading(true);
    }
    try {
      const readyHistory = await fetchWebDavHistory(webdavConfig);
      const display = readyHistory.slice(0, 3);
      if (appMountedRef.current && webdavHistoryRequestRef.current === requestId) {
        setWebdavHistory(display);
        setSelectedWebdavBackupId(prev =>
          display.some(entry => entry.id === prev) ? prev : (display[0]?.id || '')
        );
      }
      return display;
    } catch (e) {
      console.warn('WebDAV history load failed:', e);
      if (appMountedRef.current && webdavHistoryRequestRef.current === requestId) {
        setWebdavHistory([]);
        setSelectedWebdavBackupId('');
      }
      return [];
    } finally {
      if (appMountedRef.current && webdavHistoryRequestRef.current === requestId) {
        setWebdavHistoryLoading(false);
      }
    }
  }, [webdavConfig]);

  const formatNumber = (value: number, maximumFractionDigits = 2) => {
    if (!Number.isFinite(value)) return '0';
    const fixed = value.toFixed(maximumFractionDigits);
    return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  };

  const toNumber = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const cleaned = String(value ?? '').replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeDate = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return new Date().toISOString().split('T')[0];
    const cleaned = raw.replace(/[./]/g, '-');
    const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const [, y, m, d] = match;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const parsed = new Date(cleaned);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const normalizeItem = useCallback((item: Item): Item => {
    const safePrice = toNumber(item.price);
    const safeMsrp = toNumber(item.msrp);
    const safeUsage = toNumber(item.usageCount);
    const safeQuantity = Math.max(1, Math.floor(toNumber((item as any).quantity) || 1));
    const computedAvg = safeQuantity > 0 ? Number((safePrice / safeQuantity).toFixed(2)) : safePrice;
    const safeAvg = toNumber((item as any).avgPrice) || computedAvg;
    const id = item.id || (typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
    return {
      ...item,
      id,
      type: item.type === 'wishlist' ? 'wishlist' : 'owned',
      price: Number.isFinite(safePrice) ? safePrice : 0,
      msrp: Number.isFinite(safeMsrp) ? safeMsrp : 0,
      quantity: safeQuantity,
      avgPrice: Number.isFinite(safeAvg) ? safeAvg : computedAvg,
      usageCount: Number.isFinite(safeUsage) ? safeUsage : 0,
      priceHistory: Array.isArray(item.priceHistory) ? item.priceHistory : [],
      category: item.category || 'other',
      status: item.status || 'new',
      storeName: item.storeName || '',
      purchaseDate: normalizeDate(item.purchaseDate),
      imageThumb: item.imageThumb || item.image,
      hasImage: Boolean(item.image || item.imageThumb || item.hasImage)
    };
  }, []);

  const prepareItemForState = useCallback((item: Item, options?: { cacheImage?: boolean }) => {
    const normalized = normalizeItem(item);
    const nextImage = typeof normalized.image === 'string' && normalized.image ? normalized.image : undefined;
    if (options?.cacheImage && nextImage) {
      touchCachedImage(normalized.id, nextImage);
    }
    return {
      ...normalized,
      image: undefined,
      imageThumb: normalized.imageThumb || nextImage,
      hasImage: Boolean(normalized.hasImage || nextImage)
    } as Item;
  }, [normalizeItem, touchCachedImage]);

  const getResolvedItemImage = useCallback(
    async (item: Partial<Item> | null | undefined) => {
      if (!item?.id) return item?.image;
      if (item.image) return item.image;
      const cached = itemImagesRef.current[item.id];
      if (cached) return cached;
      if (!item.hasImage) return undefined;

      const pending = pendingImageLoadsRef.current.get(item.id);
      if (pending) return pending;

      const task = new Promise<string | undefined>((resolve, reject) => {
        const run = () => {
          activeImageLoadCountRef.current += 1;
          loadItemImage(item.id)
            .then(image => {
              if (image) {
                touchCachedImage(item.id!, image);
              }
              resolve(image);
            })
            .catch(reject)
            .finally(() => {
              activeImageLoadCountRef.current = Math.max(0, activeImageLoadCountRef.current - 1);
              pendingImageLoadsRef.current.delete(item.id!);
              const nextTask = imageLoadQueueRef.current.shift();
              if (nextTask) nextTask();
            });
        };

        if (activeImageLoadCountRef.current < 3) {
          run();
        } else {
          imageLoadQueueRef.current.push(run);
        }
      });

      pendingImageLoadsRef.current.set(item.id, task);
      return task;
    },
    [touchCachedImage]
  );

  useEffect(() => {
    appMountedRef.current = true;
    return () => {
      appMountedRef.current = false;
      imageLoadQueueRef.current = [];
      activeImageLoadCountRef.current = 0;
      transientUrlTimeoutsRef.current.forEach(handle => window.clearTimeout(handle));
      transientUrlTimeoutsRef.current = [];
    };
  }, []);


  const channelLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach(c => {
      const key = `chan${c}`;
      map.set(c, TEXTS[key] ? TEXTS[key][language] : c);
    });
    return map;
  }, [channels, language]);

  const channelLabelToKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    channelLabelMap.forEach((label, key) => {
      map.set(label, key);
    });
    return map;
  }, [channelLabelMap]);

  const channelAliasMap = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach(channel => {
      map.set(channel, channel);
      const key = `chan${channel}`;
      const translations = TEXTS[key];
      if (translations) {
        Object.values(translations).forEach(label => map.set(label, channel));
      }
    });
    return map;
  }, [channels]);


  const normalizeChannelValue = useCallback(
    (value?: string) => {
      if (!value) return value;
      return channelAliasMap.get(value) || channelLabelToKeyMap.get(value) || value;
    },
    [channelAliasMap, channelLabelToKeyMap]
  );

  const getDefaultModel = (provider: AiProvider) => {
    const meta = getProviderMeta(provider);
    return meta?.defaultModel || meta?.models?.[0]?.id || '';
  };

  const getDefaultBaseUrl = (provider: AiProvider, model: string) => {
    const modelMeta = getModelMeta(provider, model);
    return modelMeta?.defaultBaseUrl || getProviderMeta(provider)?.defaultBaseUrl || '';
  };

  const getCredential = (config: AiConfig, provider: AiProvider, model: string): AiCredentials => {
    return config.credentials?.[provider]?.[model] || { apiKey: '', baseUrl: '' };
  };

  const buildAiConfig = (raw: any, fallbackProvider: AiProvider): AiConfig => {
    const provider: AiProvider = raw?.provider || fallbackProvider;
    const model = raw?.model || getDefaultModel(provider);
    const credentials = raw?.credentials ? { ...raw.credentials } : {};
    const lastModelByProvider = raw?.lastModelByProvider ? { ...raw.lastModelByProvider } : {};

    if (raw?.apiKey || raw?.baseUrl) {
      const legacyModel = model || getDefaultModel(provider);
      if (!credentials[provider]) credentials[provider] = {};
      credentials[provider][legacyModel] = {
        apiKey: raw.apiKey || '',
        baseUrl: raw.baseUrl || ''
      };
    }

    if (provider && model) {
      lastModelByProvider[provider] = lastModelByProvider[provider] || model;
    }

    return {
      provider,
      model,
      credentials,
      lastModelByProvider
    };
  };

  // --- Initialization ---
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const loaded = await loadState();
      if (!isMounted) return;
      itemImagesRef.current = {};

      if (loaded.items) {
          const migratedItems = loaded.items.map(raw => prepareItemForState(raw, { cacheImage: true })).map(i => ({
              ...i,
              category: i.category || 'other'
          }));
          setItems(migratedItems);
      } else {
          setItems(INITIAL_ITEMS);
      }
      if (loaded.language) setLanguage(loaded.language);
      if (loaded.theme) setTheme(loaded.theme);
      if (loaded.appearance) setAppearance(loaded.appearance);

      const legacyCategories = (loaded as any).customCategories || [];
      const legacyChannels = (loaded as any).customChannels || [];
      const legacyStatuses = (loaded as any).customStatuses || [];

      const initialCategories = loaded.categories?.length
        ? mergeUnique([...loaded.categories, 'other'])
        : mergeUnique([...Object.keys(CATEGORY_CONFIG), ...legacyCategories]);
      const initialStatuses = loaded.statuses?.length
        ? mergeUnique([...loaded.statuses, 'new'])
        : mergeUnique([...DEFAULT_STATUSES, ...legacyStatuses]);
      const initialChannels = loaded.channels?.length
        ? loaded.channels
        : mergeUnique([...DEFAULT_CHANNELS, ...legacyChannels]);

      setCategories(initialCategories);
      setStatuses(initialStatuses);
      setChannels(initialChannels);

      const initialWebdav = loaded.webdav && loaded.webdav.serverUrl
        ? loaded.webdav
        : { serverUrl: 'https://dav.jianguoyun.com/dav/', username: '', password: '' };
      setWebdavConfig(initialWebdav);

      const initialLastBackupDate = typeof (loaded as any).lastBackupLocalDate === 'string'
        ? (loaded as any).lastBackupLocalDate
        : '';
      setLastBackupLocalDate(initialLastBackupDate);
      if (typeof (loaded as any).autoBackupEnabled === 'boolean') {
        setAutoBackupEnabled((loaded as any).autoBackupEnabled);
      }

      const initialWebdavIncludeImages = typeof (loaded as any).webdavIncludeImages === 'boolean'
        ? (loaded as any).webdavIncludeImages
        : false;
      setWebdavIncludeImages(initialWebdavIncludeImages);

      const initialWebdavRestoreMode = (loaded as any).webdavRestoreMode === 'overwrite'
        ? 'overwrite'
        : 'merge';
      setWebdavRestoreMode(initialWebdavRestoreMode);

      const fallbackProvider: AiProvider = (loaded as any).showAiFab === false ? 'disabled' : 'gemini';
      setAiConfig(buildAiConfig(loaded.aiConfig || {}, fallbackProvider));

      setIsLoaded(true);
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [prepareItemForState]);

  useEffect(() => {
    if (!isLoaded) return;
    SplashScreen.hide().catch(() => {});
  }, [isLoaded]);

  const persistedDataSnapshot = useMemo(() => ({
    items,
    categories,
    statuses,
    channels
  }), [items, categories, statuses, channels]);

  const persistedPreferencesSnapshot = useMemo(() => ({
    language,
    theme,
    appearance,
    aiConfig,
    webdav: webdavConfig,
    autoBackupEnabled,
    lastBackupLocalDate,
    webdavIncludeImages,
    webdavRestoreMode
  }), [language, theme, appearance, aiConfig, webdavConfig, autoBackupEnabled, lastBackupLocalDate, webdavIncludeImages, webdavRestoreMode]);

  const getPersistImageOverrides = useCallback(() => ({ ...itemImagesRef.current }), []);
  const getEmptyPersistImageOverrides = useCallback(() => ({}), []);

  const persistSnapshot = useCallback(async (snapshot: typeof persistedDataSnapshot, imageOverrides: Record<string, string>) => {
    await saveState(snapshot, imageOverrides);
  }, []);

  const persistPreferencesSnapshot = useCallback(async (snapshot: typeof persistedPreferencesSnapshot) => {
    await savePreferences(snapshot);
  }, []);

  useDebouncedPersist({
    enabled: isLoaded,
    snapshot: persistedDataSnapshot,
    delay: 1600,
    getImageOverrides: getPersistImageOverrides,
    persist: persistSnapshot
  });

  useDebouncedPersist({
    enabled: isLoaded,
    snapshot: persistedPreferencesSnapshot,
    delay: 450,
    getImageOverrides: getEmptyPersistImageOverrides,
    persist: persistPreferencesSnapshot
  });

  useEffect(() => {
    const validIds = new Set(items.map(item => item.id));
    const nextCache: Record<string, string> = {};

    Object.entries(itemImagesRef.current as Record<string, string>).forEach(([id, image]) => {
      if (validIds.has(id)) {
        nextCache[id] = image;
      }
    });

    itemImagesRef.current = nextCache;
    imageCacheOrderRef.current = imageCacheOrderRef.current.filter(id => Boolean(nextCache[id]));
  }, [items]);

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setEditingItem(null);
  };

  const closeExportModal = () => {
    setShowExportModal(false);
  };

  const closeAiSettingsModal = () => {
    setShowAiSettingsModal(false);
  };

  const closeQuickStartModal = () => {
    setShowQuickStartModal(false);
  };

  const closeDataManageModal = () => {
    setShowDataManageModal(false);
  };

  const closeWebdavModal = () => {
    setShowWebdavModal(false);
  };

  const closeTopOverlay = useCallback(() => {
    if (dialog) {
      setDialog(null);
      return true;
    }
    if (previewImage) {
      setPreviewImage(null);
      return true;
    }
    if (isAddModalOpen) {
      closeAddModal();
      return true;
    }
    if (showExportModal) {
      closeExportModal();
      return true;
    }
    if (showAiSettingsModal) {
      closeAiSettingsModal();
      return true;
    }
    if (showQuickStartModal) {
      closeQuickStartModal();
      return true;
    }
    if (showDataManageModal) {
      closeDataManageModal();
      return true;
    }
    if (showWebdavModal) {
      closeWebdavModal();
      return true;
    }
    return false;
  }, [dialog, isAddModalOpen, previewImage, showAiSettingsModal, showDataManageModal, showExportModal, showQuickStartModal, showWebdavModal]);

  useEffect(() => {
    if (!showWebdavModal) return undefined;
    let cancelled = false;
    void refreshWebDavHistory().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [refreshWebDavHistory, showWebdavModal]);

  const openImagePreview = useCallback(async (item: Item) => {
    const src = await getResolvedItemImage(item) || item.imageThumb;
    if (!src || !appMountedRef.current) return;
    setPreviewImage({ src, name: item.name });
  }, [getResolvedItemImage]);

  const closeImagePreview = () => {
    setPreviewImage(null);
  };

  const handleCloseImagePreview = () => {
    closeImagePreview();
  };

  const autoBackupInFlight = useRef(false);

  useEffect(() => {
    if (!isLoaded || !autoBackupEnabled) return;
    if (!Capacitor.isNativePlatform()) return;
    const { serverUrl, username, password } = webdavConfig;
    if (!serverUrl || !username || !password) return;
    if (!shouldCommitBackup(items.length)) return;
    const today = getLocalDateKey();
    if (lastBackupLocalDate === today) return;
    if (autoBackupInFlight.current) return;

    let cancelled = false;
    autoBackupInFlight.current = true;
    buildExportZip(items, undefined, webdavIncludeImages, getResolvedItemImage)
      .then(async ({ blob }) => {
        if (cancelled || !appMountedRef.current) return;
        const id = buildBackupId();
        const entry = await createSnapshotEntry(blob, id);
        await commitSnapshot(webdavConfig, entry, blob);
        if (cancelled || !appMountedRef.current) return;
        setLastBackupLocalDate(today);
        await refreshWebDavHistory();
        if (!cancelled && appMountedRef.current) {
          setSelectedWebdavBackupId(entry.id);
        }
      })
      .catch(err => console.error('Auto WebDAV backup failed', err))
      .finally(() => {
        autoBackupInFlight.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [getResolvedItemImage, isLoaded, autoBackupEnabled, refreshWebDavHistory, webdavConfig, items, lastBackupLocalDate, webdavIncludeImages]);

  useEffect(() => {
    let disposed = false;
    let removeHandle: (() => void) | null = null;
    const handler = async () => {
      if (isHandlingBackRef.current) return;
      isHandlingBackRef.current = true;
      try {
        if (closeTopOverlay()) return;
        await CapacitorApp.exitApp();
      } finally {
        queueMicrotask(() => {
          if (!disposed) {
            isHandlingBackRef.current = false;
          }
        });
      }
    };

    void CapacitorApp.addListener('backButton', handler).then(handle => {
      if (disposed) {
        void handle.remove();
        return;
      }
      removeHandle = () => {
        void handle.remove();
      };
    });

    return () => {
      disposed = true;
      removeHandle?.();
    };
  }, [closeTopOverlay]);

  useEffect(() => {
    if (!aiConfig.provider || aiConfig.provider === 'disabled') return;
    const models = getProviderModels(aiConfig.provider);
    if (!models.length) return;
    if (!models.some(m => m.id === aiConfig.model)) {
      const fallbackModel = aiConfig.lastModelByProvider?.[aiConfig.provider] || models[0].id;
      setAiConfig(prev => ({
        ...prev,
        model: fallbackModel,
        lastModelByProvider: { ...(prev.lastModelByProvider || {}), [prev.provider]: fallbackModel }
      }));
    }
  }, [aiConfig.provider, aiConfig.model, aiConfig.lastModelByProvider]);

  // --- Dark Mode Logic ---
  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    const applyTheme = (isDark: boolean) => {
        if (isDark) {
            root.classList.add('dark');
            metaThemeColor?.setAttribute('content', '#020617'); // slate-950
        } else {
            root.classList.remove('dark');
            metaThemeColor?.setAttribute('content', '#f9fafb'); // gray-50
        }
    };

    if (appearance === 'dark') {
        applyTheme(true);
    } else if (appearance === 'light') {
        applyTheme(false);
    } else {
        // System
        applyTheme(mediaQuery.matches);
        const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [appearance]);

  const openAlert = (message: string, title = TEXTS.notice[language]) =>
    new Promise<void>(resolve => {
      setDialog({
        type: 'alert',
        title,
        message,
        confirmText: TEXTS.ok[language],
        onConfirm: () => {
          setDialog(null);
          resolve();
        },
        onCancel: () => {
          setDialog(null);
          resolve();
        }
      });
    });

  const openConfirm = (message: string, title = TEXTS.confirm[language]) =>
    new Promise<boolean>(resolve => {
      setDialog({
        type: 'confirm',
        title,
        message,
        confirmText: TEXTS.confirm[language],
        cancelText: TEXTS.cancel[language],
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(false);
        }
      });
    });

  const openPrompt = (title: string, defaultValue = '') =>
    new Promise<string | null>(resolve => {
      setDialog({
        type: 'prompt',
        title,
        confirmText: TEXTS.confirm[language],
        cancelText: TEXTS.cancel[language],
        defaultValue,
        placeholder: TEXTS.inputName[language],
        onConfirm: (value?: string) => {
          setDialog(null);
          resolve(value && value.trim() ? value.trim() : null);
        },
        onCancel: () => {
          setDialog(null);
          resolve(null);
        }
      });
    });

  // --- Handlers ---
  const handleSaveItem = useCallback((itemData: Partial<Item>) => {
    const nextImage = typeof itemData.image === 'string' && itemData.image ? itemData.image : undefined;
    if (itemData.id) {
      setItems(prev => prev.map(i => {
        if (i.id !== itemData.id) return i;
        const nextPrice = itemData.price ?? i.price ?? 0;
        const nextQty = Math.max(1, Math.floor(toNumber((itemData.quantity ?? i.quantity) as any) || 1));
        const nextAvg = itemData.avgPrice ?? Number((nextPrice / nextQty).toFixed(2));
        return prepareItemForState({
          ...i,
          ...itemData,
          quantity: nextQty,
          avgPrice: nextAvg,
          hasImage: nextImage ? true : Boolean(itemData.image === undefined ? i.hasImage : false)
        } as Item, { cacheImage: true });
      }));
      if (!nextImage && itemData.image === '') {
        dropCachedImage(itemData.id);
      }
    } else {
      const newId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const quantity = Math.max(1, Math.floor(toNumber(itemData.quantity as any) || 1));
      const price = itemData.price || 0;
      const avgPrice = itemData.avgPrice ?? Number((price / quantity).toFixed(2));
      const newItem = prepareItemForState({
        id: newId,
        type: (itemData.type as any) || (activeTab === 'wishlist' ? 'wishlist' : 'owned'),
        name: itemData.name || TEXTS.unknownItem[language],
        price,
        msrp: itemData.msrp || price || 0,
        quantity,
        avgPrice,
        purchaseDate: itemData.purchaseDate || new Date().toISOString().split('T')[0],
        currency: 'CNY',
        status: (itemData.status as any) || 'new',
        category: (itemData.category as any) || 'other',
        note: itemData.note || '',
        link: itemData.link || '',
        storeName: itemData.storeName || '',
        image: itemData.image,
        imageThumb: itemData.imageThumb,
        hasImage: Boolean(nextImage || itemData.imageThumb),
        usageCount: itemData.usageCount || 0,
        discountRate: itemData.discountRate,
        channel: itemData.channel,
        priceHistory: itemData.priceHistory || [],
        valueDisplay: itemData.valueDisplay || 'both'
      } as Item, { cacheImage: true });
      setItems(prev => [newItem, ...prev]);
    }
    closeAddModal();
  }, [activeTab, dropCachedImage, language, prepareItemForState]);

  const handleEditItem = useCallback((item: Item) => {
      setEditingItem(item);
      setInitialAddMode('manual');
      setIsAddModalOpen(true);
  }, []);

  const handleOpenAdd = (mode: 'ai' | 'manual') => {
      setEditingItem(null);
      setInitialAddMode(aiEnabled ? mode : 'manual');
      setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
      closeAddModal();
  };

  const handleOpenAiSettings = () => {
      setShowAiSettingsModal(true);
  };

  const handleCloseAiSettings = () => {
      closeAiSettingsModal();
  };

  const handleOpenQuickStart = () => {
      setShowQuickStartModal(true);
  };

  const handleCloseQuickStart = () => {
      closeQuickStartModal();
  };

  const handleOpenDataManage = () => {
      setShowDataManageModal(true);
  };

  const handleCloseDataManage = () => {
      closeDataManageModal();
  };

  const handleOpenWebdav = () => {
      setShowWebdavModal(true);
  };

  const handleCloseWebdav = () => {
      closeWebdavModal();
  };

  const quickStartSteps = [
    { title: TEXTS.quickStartStep1Title[language], desc: TEXTS.quickStartStep1Desc[language] },
    { title: TEXTS.quickStartStep2Title[language], desc: TEXTS.quickStartStep2Desc[language] },
    { title: TEXTS.quickStartStep3Title[language], desc: TEXTS.quickStartStep3Desc[language] },
    { title: TEXTS.quickStartStep4Title[language], desc: TEXTS.quickStartStep4Desc[language] },
    { title: TEXTS.quickStartStep5Title[language], desc: TEXTS.quickStartStep5Desc[language] }
  ];

  const deleteItemById = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    dropCachedImage(id);
  }, [dropCachedImage]);

  const handleDeleteItem = useCallback(async (id: string) => {
    const confirmed = await openConfirm(TEXTS.deleteConfirm[language]);
    if (confirmed) deleteItemById(id);
  }, [deleteItemById, language, openConfirm]);

  const handleAddUsage = useCallback((item: Item) => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, usageCount: (i.usageCount || 0) + 1 } : i));
  }, []);


  // Managed Data Handlers
  const handleAddCategory = async () => {
    const value = await openPrompt(TEXTS.addCategory[language]);
    if (!value) return;
    if (categories.includes(value)) {
      await openAlert(TEXTS.alreadyExists[language]);
      return;
    }
    setCategories(prev => [...prev, value]);
  };

  const handleEditCategory = async (current: string) => {
    const value = await openPrompt(TEXTS.editLabel[language], current);
    if (!value || value === current) return;
    if (categories.includes(value)) {
      await openAlert(TEXTS.alreadyExists[language]);
      return;
    }
    setCategories(prev => prev.map(c => (c === current ? value : c)));
    setItems(prev => prev.map(i => (i.category === current ? { ...i, category: value } : i)));
  };

  const handleDeleteCategory = async (current: string) => {
    if (current === 'other') {
      await openAlert(TEXTS.requiredTag[language]);
      return;
    }
    const confirmed = await openConfirm(TEXTS.deleteCategoryConfirm[language]);
    if (!confirmed) return;
    setCategories(prev => prev.filter(c => c !== current));
    setItems(prev => prev.map(i => (i.category === current ? { ...i, category: 'other' } : i)));
  };

  const handleAddStatus = async () => {
    const value = await openPrompt(TEXTS.addStatus[language]);
    if (!value) return;
    if (statuses.includes(value)) {
      await openAlert(TEXTS.alreadyExists[language]);
      return;
    }
    setStatuses(prev => [...prev, value]);
  };

  const handleEditStatus = async (current: string) => {
    const value = await openPrompt(TEXTS.editLabel[language], current);
    if (!value || value === current) return;
    if (statuses.includes(value)) {
      await openAlert(TEXTS.alreadyExists[language]);
      return;
    }
    setStatuses(prev => prev.map(s => (s === current ? value : s)));
    setItems(prev => prev.map(i => (i.status === current ? { ...i, status: value } : i)));
  };

  const handleDeleteStatus = async (current: string) => {
    if (current === 'new') {
      await openAlert(TEXTS.requiredTag[language]);
      return;
    }
    const confirmed = await openConfirm(TEXTS.deleteStatusConfirm[language]);
    if (!confirmed) return;
    setStatuses(prev => prev.filter(s => s !== current));
    setItems(prev => prev.map(i => (i.status === current ? { ...i, status: 'new' } : i)));
  };

  const handleAddChannel = async () => {
    const value = await openPrompt(TEXTS.addChannel[language]);
    if (!value) return;
    if (channels.includes(value)) {
      await openAlert(TEXTS.alreadyExists[language]);
      return;
    }
    setChannels(prev => [...prev, value]);
  };

  const handleEditChannel = async (current: string) => {
    const value = await openPrompt(TEXTS.editLabel[language], current);
    if (!value || value === current) return;
    if (channels.includes(value)) {
      await openAlert(TEXTS.alreadyExists[language]);
      return;
    }
    setChannels(prev => prev.map(c => (c === current ? value : c)));
    setItems(prev => prev.map(i => (i.channel === current ? { ...i, channel: value } : i)));
  };

  const handleDeleteChannel = async (current: string) => {
    const confirmed = await openConfirm(TEXTS.deleteChannelConfirm[language]);
    if (!confirmed) return;
    setChannels(prev => prev.filter(c => c !== current));
    setItems(prev => prev.map(i => (i.channel === current ? { ...i, channel: '' } : i)));
  };

  const handleSelectProvider = (provider: AiProvider) => {
    if (provider === 'disabled') {
      setAiConfig(prev => ({ ...prev, provider }));
      return;
    }
    const fallbackModel = aiConfig.lastModelByProvider?.[provider] || getDefaultModel(provider);
    setAiConfig(prev => ({
      ...prev,
      provider,
      model: fallbackModel,
      lastModelByProvider: { ...(prev.lastModelByProvider || {}), [provider]: fallbackModel }
    }));
  };

  const handleSelectModel = (model: string) => {
    setAiConfig(prev => ({
      ...prev,
      model,
      lastModelByProvider: { ...(prev.lastModelByProvider || {}), [prev.provider]: model }
    }));
  };

  const handleUpdateCredential = (patch: Partial<AiCredentials>) => {
    setAiConfig(prev => {
      const provider = prev.provider;
      const model = prev.model || getDefaultModel(provider);
      if (!provider || provider === 'disabled' || !model) return prev;
      const nextCredentials = { ...(prev.credentials || {}) };
      const providerMap = { ...(nextCredentials[provider] || {}) };
      const current = providerMap[model] || { apiKey: '', baseUrl: '' };
      providerMap[model] = { ...current, ...patch };
      nextCredentials[provider] = providerMap;
      return { ...prev, credentials: nextCredentials };
    });
  };

  const getActiveAiConfig = (config: AiConfig): AiRuntimeConfig | null => {
    if (!config.provider || config.provider === 'disabled') return null;
    const model = config.model || getDefaultModel(config.provider);
    const cred = getCredential(config, config.provider, model);
    return {
      provider: config.provider,
      model,
      apiKey: cred.apiKey || '',
      baseUrl: cred.baseUrl || getDefaultBaseUrl(config.provider, model)
    };
  };

  const ensurePublicStoragePermission = async () => {
    if (Capacitor.getPlatform() !== 'android') return true;
    const current = await Filesystem.checkPermissions();
    if (current.publicStorage === 'granted') return true;
    const requested = await Filesystem.requestPermissions();
    return requested.publicStorage === 'granted';
  };


  const handleOpenExportModal = () => {
      const csv = exportCSV(items);
      const csvContent = '\ufeff' + csv; // Add BOM
      setExportData(csvContent);
      setShowExportModal(true);
  };

  const handleCloseExportModal = () => {
      closeExportModal();
  };

    const executeFileSave = async () => {
      const csvContent = exportData || `\ufeff${exportCSV(items)}`;
      const { fileName, blob, base64 } = await buildExportZip(items, csvContent, true, getResolvedItemImage);

      const triggerDownload = (href: string) => {
          const link = document.createElement('a');
          link.href = href;
          link.setAttribute('download', fileName);
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      };

      if (Capacitor.isNativePlatform()) {
          try {
              const permissionOk = await ensurePublicStoragePermission();
              if (!permissionOk) {
                  await openAlert(TEXTS.saveFailed[language]);
                  return;
              }
              const result = await Filesystem.writeFile({
                  path: fileName,
                  data: base64,
                  directory: Directory.Documents
              });
              console.log('Export success via Filesystem:', result.uri);
              await openAlert(TEXTS.exportSuccess[language]);
              return;
          } catch (error) {
              console.warn('Filesystem export failed:', error);
          }
      }

      try {
          if (window.showSaveFilePicker) {
              const handle = await window.showSaveFilePicker({
                  suggestedName: fileName,
                  types: [{
                      description: 'ZIP File',
                      accept: { 'application/zip': ['.zip'] }
                  }]
              });
              const writable = await handle.createWritable();
              await writable.write(blob);
              await writable.close();
              return;
          }
      } catch (err) {
          console.warn('FileSystem API failed or cancelled:', err);
      }

      try {
          const url = URL.createObjectURL(blob);
          triggerDownload(url);
          const timeoutHandle = window.setTimeout(() => {
            URL.revokeObjectURL(url);
            transientUrlTimeoutsRef.current = transientUrlTimeoutsRef.current.filter(handle => handle !== timeoutHandle);
          }, 1000);
          transientUrlTimeoutsRef.current.push(timeoutHandle);
          return;
      } catch (e) {
          console.warn('Blob download failed:', e);
      }

      try {
          const dataUri = `data:application/zip;base64,${base64}`;
          triggerDownload(dataUri);
      } catch (e) {
          console.error('Data URI download failed:', e);
          await openAlert(TEXTS.saveFailed[language]);
      }
  };


    const executeShare = async () => {
      const csvContent = exportData || `\ufeff${exportCSV(items)}`;
      const { fileName, blob, base64 } = await buildExportZip(items, csvContent, true, getResolvedItemImage);

      if (Capacitor.isNativePlatform()) {
          try {
              const result = await Filesystem.writeFile({
                  path: fileName,
                  data: base64,
                  directory: Directory.Cache
              });
              await Share.share({
                  files: [result.uri],
                  title: 'Tracker Backup',
                  dialogTitle: 'Tracker Backup'
              });
              return;
          } catch (e) {
              const message = String((e as any)?.message || e || '');
              if (/cancel|canceled|cancelled/i.test(message)) {
                  return;
              }
              console.warn('Native share failed:', e);
              await openAlert(TEXTS.shareNotSupported[language]);
          }
      }

      const file = new File([blob], fileName, { type: 'application/zip' });
      try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: 'Tracker Backup'
              });
          } else {
              await openAlert(TEXTS.shareNotSupported[language]);
          }
      } catch (e) {
          console.warn('Share failed:', e);
      }
  };


  const executeCopy = async () => {
      try {
          await navigator.clipboard.writeText(exportData);
          await openAlert(TEXTS.copySuccess[language]);
      } catch {
          await openAlert(TEXTS.copyFailed[language]);
      }
  };
  const mergeImportedItems = (prev: Item[], incoming: Item[]) => {
    const byId = new Map<string, Item>(prev.map(item => [item.id, item]));
    const signature = (item: Item) => [
      item.type,
      item.name,
      item.price,
      item.purchaseDate,
      item.channel,
      item.category,
      item.status
    ].join('|');
    const bySignature = new Map<string, string>(prev.map(item => [signature(item), item.id]));

    incoming.forEach(raw => {
      const normalized = prepareItemForState(raw as Item, { cacheImage: true });
      const sig = signature(normalized);
      const existingId = byId.has(normalized.id) ? normalized.id : bySignature.get(sig);
      if (existingId && byId.has(existingId)) {
        const current = byId.get(existingId)!;
        byId.set(existingId, { ...current, ...normalized, id: existingId });
      } else {
        byId.set(normalized.id, normalized);
        bySignature.set(sig, normalized.id);
      }
    });

    return Array.from(byId.values());
  };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const newItems = await importBackupFile(file);
      if (!appMountedRef.current) return;
      setItems(prev => {
        const byId = new Map<string, Item>(prev.map(item => [item.id, item]));
        const signature = (item: Item) => [
          item.type,
          item.name,
          item.price,
          item.purchaseDate,
          item.channel,
          item.category,
          item.status
        ].join('|');
        const bySignature = new Map<string, string>(prev.map(item => [signature(item), item.id]));

        newItems.forEach(raw => {
          const normalized = prepareItemForState(raw as Item, { cacheImage: true });
          const sig = signature(normalized);
          const existingId = byId.has(normalized.id) ? normalized.id : bySignature.get(sig);
          if (existingId && byId.has(existingId)) {
            const current = byId.get(existingId)!;
            byId.set(existingId, { ...current, ...normalized, id: existingId });
          } else {
            byId.set(normalized.id, normalized);
            bySignature.set(sig, normalized.id);
          }
        });

        return Array.from(byId.values());
      });
    } catch (error) {
      console.warn('Import failed:', error);
      await openAlert(TEXTS.importFailed[language]);
    } finally {
      e.target.value = '';
    }
  };
  const handleWebDavUpload = async () => {
    const { serverUrl, username, password } = webdavConfig;
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      await openAlert(t('webdavMissing'));
      return;
    }

    try {
      const csvContent = `\uFEFF${exportCSV(items)}`;
      const { blob } = await buildExportZip(items, csvContent, webdavIncludeImages, getResolvedItemImage);
      if (!shouldCommitBackup(items.length)) {
        await openAlert(t('webdavUploadFailed'));
        return;
      }
      const id = buildBackupId();
      const entry = await createSnapshotEntry(blob, id);
      await commitSnapshot(webdavConfig, entry, blob);
      if (!appMountedRef.current) return;
      setLastBackupLocalDate(getLocalDateKey());
      await refreshWebDavHistory();
      if (!appMountedRef.current) return;
      setSelectedWebdavBackupId(entry.id);
      await openAlert(t('webdavUploadSuccess'));
    } catch (e) {
      console.warn('WebDAV upload failed:', e);
      await openAlert(t('webdavUploadFailed'));
    }
  };

  const handleWebDavDownload = async () => {
    const { serverUrl, username, password } = webdavConfig;
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      await openAlert(t('webdavMissing'));
      return;
    }
    try {
      let history = webdavHistory;
      if (!history.length) {
        history = await refreshWebDavHistory();
      }

      const selected = history.find(entry => entry.id === selectedWebdavBackupId) || history[0];
      if (!selected) {
        await openAlert(t('webdavNoBackups', 'No backups available.'));
        return;
      }

      const mode = webdavRestoreMode;
      if (mode === 'overwrite') {
        const confirmed = await openConfirm(TEXTS.webdavRestoreOverwriteConfirm[language]);
        if (!confirmed) return;
      }

      const restored = await tryRestoreSnapshot(webdavConfig, selected, mode);
      if (!appMountedRef.current) return;
      if (restored) {
        await openAlert(t('webdavDownloadSuccess'));
        return;
      }

      await openAlert(t('webdavDownloadFailed'));
    } catch (e) {
      console.warn('WebDAV download failed:', e);
      await openAlert(t('webdavDownloadFailed'));
    }
  };
  // --- Computed ---
  const themeColors = THEMES[theme];
  const aiEnabled = aiConfig.provider !== 'disabled';
  const activeAiConfig = getActiveAiConfig(aiConfig);
  const providerModels = aiEnabled ? getProviderModels(aiConfig.provider) : [];
  const selectedModel = aiEnabled ? (aiConfig.model || providerModels[0]?.id || '') : '';
  const currentCredential = aiEnabled && selectedModel
    ? getCredential(aiConfig, aiConfig.provider, selectedModel)
    : { apiKey: '', baseUrl: '' };
  const baseUrlPlaceholder = aiEnabled && selectedModel
    ? getDefaultBaseUrl(aiConfig.provider, selectedModel)
    : '';
  const ownedItems = useMemo(() => items.filter(i => i.type === 'owned'), [items]);
  const wishlistItems = useMemo(() => items.filter(i => i.type === 'wishlist'), [items]);
  const totalValue = useMemo(() => ownedItems.reduce((acc, curr) => acc + curr.price, 0), [ownedItems]);

  const handleChangeLanguage = useCallback((nextLanguage: Language) => {
    if (nextLanguage === language) return;
    startUiTransition(() => {
      setLanguage(nextLanguage);
    });
  }, [language]);

  const handleChangeTab = useCallback((nextTab: Tab) => {
    if (nextTab === activeTab) return;
    startUiTransition(() => {
      if (nextTab === 'owned' || nextTab === 'wishlist' || nextTab === 'stats') {
        setMountedTabs(prev => ({ ...prev, [nextTab]: true }));
      }
      setActiveTab(nextTab);
    });
  }, [activeTab]);

  // --- Render ---
  return (
    <div className={`min-h-screen ${themeColors.surface} ${themeColors.onSurface} font-sans transition-colors duration-500`}>
      {/* Top Bar */}
      <div className="pt-12 px-6 pb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Tracker</h1>
        {activeTab === 'profile' ? (
             <p className="opacity-60 text-sm">{TEXTS.tabMine[language]}</p>
        ) : activeTab === 'stats' ? (
             <p className="opacity-60 text-sm">{TEXTS.tabStats[language]}</p>
        ) : activeTab === 'owned' ? (
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-light">{formatCurrency(totalValue, 'CNY', language)}</span>
                <span className="text-sm opacity-60 uppercase tracking-widest font-semibold">{TEXTS.totalValue[language]}</span>
            </div>
        ) : null}
      </div>


      {/* PROFILE TAB (Simplified) */}
      {activeTab === 'profile' && (
        <div className="p-6 space-y-6 pb-32">
          {/* Quick Access */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 shadow-sm space-y-3 transition-colors">
            <button
              onClick={handleOpenQuickStart}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-3 font-semibold">
                <ICONS.BookOpen size={20}/> {TEXTS.quickStart[language]}
              </span>
              <ICONS.ChevronRight size={18} className="opacity-40" />
            </button>
            <button
              onClick={handleOpenAiSettings}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-3 font-semibold">
                <ICONS.Sparkles size={20}/> {TEXTS.aiSettings[language]}
              </span>
              <ICONS.ChevronRight size={18} className="opacity-40" />
            </button>
            <button
              onClick={handleOpenDataManage}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-3 font-semibold">
                <ICONS.Database size={20}/> {TEXTS.manageData[language]}
              </span>
              <ICONS.ChevronRight size={18} className="opacity-40" />
            </button>
            <button
              onClick={handleOpenWebdav}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <span className="flex items-center gap-3 font-semibold">
                <ICONS.Database size={20}/> {TEXTS.webdavTitle[language]}
              </span>
              <ICONS.ChevronRight size={18} className="opacity-40" />
            </button>
          </div>

          {/* Settings Cards */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm space-y-6 transition-colors">
            {/* Theme Color */}
            <div>
              <h3 className="flex items-center gap-2 font-bold mb-4 opacity-70"><ICONS.Palette size={18}/> {TEXTS.theme[language]}</h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                {(Object.keys(THEMES) as ThemeColor[]).map(c => (
                  <button 
                    key={c} 
                    onClick={() => setTheme(c)}
                    className={`w-12 h-12 rounded-full border-4 ${theme === c ? 'border-gray-300 dark:border-gray-500' : 'border-transparent'}`}
                    style={{ backgroundColor: c === 'blue' ? '#2563eb' : c === 'green' ? '#059669' : c === 'violet' ? '#7c3aed' : c === 'orange' ? '#ea580c' : '#e11d48' }}
                  />
                ))}
              </div>
            </div>

            {/* Appearance Mode */}
            <div>
              <h3 className="flex items-center gap-2 font-bold mb-4 opacity-70"><ICONS.Moon size={18}/> {TEXTS.appearance[language]}</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                    { mode: 'light', label: TEXTS.modeLight, icon: ICONS.Sun },
                    { mode: 'dark', label: TEXTS.modeDark, icon: ICONS.Moon },
                    { mode: 'system', label: TEXTS.modeSystem, icon: ICONS.Monitor }
                ].map((opt) => (
                    <button
                        key={opt.mode}
                        onClick={() => setAppearance(opt.mode as AppearanceMode)}
                        className={`flex flex-col items-center justify-center py-3 rounded-xl gap-1 text-xs font-medium transition-all ${
                            appearance === opt.mode 
                            ? `${themeColors.primary} text-white shadow-md` 
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                        <opt.icon size={18} />
                        {opt.label[language]}
                    </button>
                ))}
              </div>
            </div>


            {/* Language */}
            <div>
              <h3 className="flex items-center gap-2 font-bold mb-4 opacity-70"><ICONS.Globe size={18}/> {TEXTS.language[language]}</h3>
              <div className="grid grid-cols-2 gap-3">
                {(['zh-CN', 'zh-TW', 'en', 'ja'] as Language[]).map(l => (
                  <button 
                    key={l}
                    onClick={() => handleChangeLanguage(l)}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${language === l ? `${themeColors.primary} text-white shadow-md` : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                  >
                    {l === 'zh-CN' ? TEXTS.langZhCN[language] : l === 'zh-TW' ? TEXTS.langZhTW[language] : l === 'en' ? TEXTS.langEn[language] : TEXTS.langJa[language]}
                  </button>
                ))}
              </div>
            </div>
          </div>


          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm space-y-4 transition-colors">
             <button onClick={handleOpenExportModal} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800">
                <span className="flex items-center gap-3 font-semibold"><ICONS.Download size={20}/> {TEXTS.export[language]}</span>
             </button>
             <label className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer">
                <span className="flex items-center gap-3 font-semibold"><ICONS.Upload size={20}/> {TEXTS.import[language]}</span>
                <input type="file" accept=".csv,.zip,application/zip" hidden onChange={handleImport} />
             </label>
          </div>
        </div>
      )}

      {/* EXPORT MODAL */}
      {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={handleCloseExportModal} style={{pointerEvents: 'auto'}} />
            <div className={`relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl transform transition-transform duration-300 pointer-events-auto ${themeColors.surface}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{TEXTS.exportTitle[language]}</h2>
                    <button onClick={handleCloseExportModal} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full">
                        <ICONS.X size={20}/>
                    </button>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{TEXTS.exportDesc[language]}</p>

                <div className="space-y-3 mb-6">
                    <button 
                        onClick={executeFileSave}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 ${themeColors.primary}`}
                    >
                        <ICONS.Download size={20}/> {TEXTS.btnSaveFile[language]}
                    </button>
                    
                    <button 
                        onClick={executeShare}
                        className="w-full py-3 rounded-xl font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2"
                    >
                        <ICONS.Share2 size={20}/> {TEXTS.btnShareFile[language]}
                    </button>

                    <button 
                        onClick={executeCopy}
                        className="w-full py-3 rounded-xl font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2"
                    >
                        <ICONS.Copy size={20}/> {TEXTS.btnCopy[language]}
                    </button>
                </div>

                <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">{TEXTS.manualCopyTip[language]}</p>
                    <textarea 
                        readOnly 
                        value={exportData} 
                        className="w-full h-32 bg-transparent text-xs font-mono text-gray-500 dark:text-gray-400 focus:outline-none resize-none"
                    />
                </div>
            </div>
          </div>
      )}

      <Suspense fallback={null}>
      <SheetModal
        isOpen={showQuickStartModal}
        title={TEXTS.quickStart[language]}
        theme={theme}
        onClose={handleCloseQuickStart}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-6">
            {TEXTS.quickStartSubtitle[language]}
          </p>
          <div className="space-y-3">
            {quickStartSteps.map((step, index) => (
              <div
                key={step.title}
                className="flex gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${themeColors.primary}`}>
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{step.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 leading-6 mt-1">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 leading-6 px-1">
            {TEXTS.quickStartTip[language]}
          </div>
        </div>
      </SheetModal>

      <SheetModal
        isOpen={showAiSettingsModal}
        title={TEXTS.aiSettings[language]}
        theme={theme}
        onClose={handleCloseAiSettings}
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold opacity-50 mb-3 uppercase">{TEXTS.aiProvider[language]}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">{TEXTS.aiProviderHint[language]}</p>
            <div className="max-h-56 overflow-y-auto no-scrollbar overscroll-contain pr-1">
              <div className="grid grid-cols-3 gap-2">
                {AI_PROVIDERS.map(provider => {
                  const isSelected = aiConfig.provider === provider.id;
                  return (
                    <button
                      key={provider.id}
                      onClick={() => handleSelectProvider(provider.id)}
                      className={`min-h-[3rem] px-2 py-2 rounded-xl text-[11px] leading-tight font-semibold transition-all break-words ${
                        isSelected
                          ? `${themeColors.primary} text-white shadow-md`
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {TEXTS[provider.labelKey][language]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {aiEnabled && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.aiModel[language]}</label>
                <div className="relative">
                  <select
                    value={aiConfig.model || providerModels[0]?.id || ''}
                    onChange={(e) => handleSelectModel(e.target.value)}
                    className="w-full appearance-none p-4 pr-10 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
                  >
                    {providerModels.map(model => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                  <ICONS.ChevronDown size={16} className="absolute right-4 top-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.aiApiKey[language]}</label>
                <input
                  type="text"
                  value={currentCredential.apiKey}
                  onChange={(e) => handleUpdateCredential({ apiKey: e.target.value })}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.aiBaseUrl[language]}</label>
                <input
                  value={currentCredential.baseUrl || ''}
                  onChange={(e) => handleUpdateCredential({ baseUrl: e.target.value })}
                  className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
                  placeholder={baseUrlPlaceholder}
                />
              </div>
            </div>
          )}
        </div>
      </SheetModal>

      <SheetModal
        isOpen={showDataManageModal}
        title={TEXTS.manageData[language]}
        theme={theme}
        onClose={handleCloseDataManage}
      >
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold opacity-60">{TEXTS.manageCat[language]}</h4>
              <button onClick={handleAddCategory} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                <ICONS.Plus size={14}/> {TEXTS.addCategory[language]}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.length === 0 && <p className="text-xs opacity-40">{TEXTS.none[language]}</p>}
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm">
                  <span className="max-w-[120px] truncate">{cat}</span>
                  <button onClick={() => handleEditCategory(cat)} className="opacity-60 hover:opacity-100">
                    <ICONS.Edit3 size={14}/>
                  </button>
                  <button onClick={() => handleDeleteCategory(cat)} className="opacity-60 hover:opacity-100">
                    <ICONS.Trash2 size={14}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold opacity-60">{TEXTS.manageStatus[language]}</h4>
              <button onClick={handleAddStatus} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                <ICONS.Plus size={14}/> {TEXTS.addStatus[language]}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {statuses.length === 0 && <p className="text-xs opacity-40">{TEXTS.none[language]}</p>}
              {statuses.map(status => (
                <div key={status} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm">
                  <span className="max-w-[120px] truncate">{status}</span>
                  <button onClick={() => handleEditStatus(status)} className="opacity-60 hover:opacity-100">
                    <ICONS.Edit3 size={14}/>
                  </button>
                  <button onClick={() => handleDeleteStatus(status)} className="opacity-60 hover:opacity-100">
                    <ICONS.Trash2 size={14}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold opacity-60">{TEXTS.manageChan[language]}</h4>
              <button onClick={handleAddChannel} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                <ICONS.Plus size={14}/> {TEXTS.addChannel[language]}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {channels.length === 0 && <p className="text-xs opacity-40">{TEXTS.none[language]}</p>}
              {channels.map(chan => (
                <div key={chan} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm">
                  <span className="max-w-[120px] truncate">{chan}</span>
                  <button onClick={() => handleEditChannel(chan)} className="opacity-60 hover:opacity-100">
                    <ICONS.Edit3 size={14}/>
                  </button>
                  <button onClick={() => handleDeleteChannel(chan)} className="opacity-60 hover:opacity-100">
                    <ICONS.Trash2 size={14}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetModal>

      <SheetModal
        isOpen={showWebdavModal}
        title={TEXTS.webdavTitle[language]}
        theme={theme}
        onClose={handleCloseWebdav}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.webdavServer[language]}</label>
            <input
              type="text"
              value={webdavConfig.serverUrl}
              onChange={(e) => setWebdavConfig(prev => ({ ...prev, serverUrl: e.target.value }))}
              className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.webdavUser[language]}</label>
            <input
              type="text"
              value={webdavConfig.username}
              onChange={(e) => setWebdavConfig(prev => ({ ...prev, username: e.target.value }))}
              className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.webdavPass[language]}</label>
            <input
              type="password"
              value={webdavConfig.password}
              onChange={(e) => setWebdavConfig(prev => ({ ...prev, password: e.target.value }))}
              className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
            />
          </div>
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{TEXTS.webdavAutoBackup[language]}</div>
              <div className="text-xs text-gray-400">{TEXTS.webdavAutoBackupHint[language]}</div>
            </div>
            <button
              onClick={() => setAutoBackupEnabled(prev => !prev)}
              className={`w-12 h-7 rounded-full transition-colors flex items-center ${autoBackupEnabled ? themeColors.primary : 'bg-gray-300 dark:bg-slate-700'}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${autoBackupEnabled ? 'translate-x-6' : 'translate-x-1'}`}></span>
            </button>
          </div>
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{TEXTS.webdavIncludeImages[language]}</div>
              <div className="text-xs text-gray-400">{TEXTS.webdavIncludeImagesHint[language]}</div>
            </div>
            <button
              onClick={() => setWebdavIncludeImages(prev => !prev)}
              className={`w-12 h-7 rounded-full transition-colors flex items-center ${webdavIncludeImages ? themeColors.primary : 'bg-gray-300 dark:bg-slate-700'}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${webdavIncludeImages ? 'translate-x-6' : 'translate-x-1'}`}></span>
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.webdavRestoreMode[language]}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWebdavRestoreMode('overwrite')}
                className={`w-full text-left p-3 rounded-2xl border transition-colors ${
                  webdavRestoreMode === 'overwrite'
                    ? `${themeColors.primary} text-white border-transparent`
                    : 'bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-200 border-gray-100 dark:border-slate-700'
                }`}
              >
                <div className="text-sm font-semibold">{TEXTS.webdavRestoreOverwrite[language]}</div>
                <div className={`text-[10px] ${webdavRestoreMode === 'overwrite' ? 'text-white/80' : 'text-gray-400'}`}>
                  {TEXTS.webdavRestoreOverwriteHint[language]}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setWebdavRestoreMode('merge')}
                className={`w-full text-left p-3 rounded-2xl border transition-colors ${
                  webdavRestoreMode === 'merge'
                    ? `${themeColors.primary} text-white border-transparent`
                    : 'bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-200 border-gray-100 dark:border-slate-700'
                }`}
              >
                <div className="text-sm font-semibold">{TEXTS.webdavRestoreMerge[language]}</div>
                <div className={`text-[10px] ${webdavRestoreMode === 'merge' ? 'text-white/80' : 'text-gray-400'}`}>
                  {TEXTS.webdavRestoreMergeHint[language]}
                </div>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.webdavRecentBackups[language]}</label>
              <button
                type="button"
                onClick={() => void refreshWebDavHistory()}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {TEXTS.webdavRefresh[language]}
              </button>
            </div>
            {webdavHistoryLoading ? (
              <div className="text-xs text-gray-400 px-2">{TEXTS.webdavLoadingBackups[language]}</div>
            ) : webdavHistory.length === 0 ? (
              <div className="text-xs text-gray-400 px-2">{TEXTS.webdavNoBackups[language]}</div>
            ) : (
              <div className="space-y-2">
                {webdavHistory.map(entry => {
                  const selected = entry.id === selectedWebdavBackupId;
                  const sizeLabel = formatBytes(entry.size);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedWebdavBackupId(entry.id)}
                      className={`w-full text-left p-3 rounded-2xl border transition-colors ${
                        selected
                          ? `${themeColors.primary} text-white border-transparent`
                          : 'bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-200 border-gray-100 dark:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-semibold">{formatBackupLabel(entry)}</div>
                      <div className={`text-xs ${selected ? 'text-white/80' : 'text-gray-400'}`}>
                        {entry.id}{sizeLabel ? ` | ${sizeLabel}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleWebDavUpload}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-semibold"
            >
              <ICONS.Upload size={18}/> {TEXTS.webdavUpload[language]}
            </button>
            <button
              onClick={handleWebDavDownload}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 font-semibold"
            >
              <ICONS.Download size={18}/> {TEXTS.webdavDownload[language]}
            </button>
          </div>
        </div>
      </SheetModal>
      </Suspense>


      <div
        className={mountedTabs.owned ? (activeTab === 'owned' ? 'block' : 'hidden') : 'hidden'}
        aria-hidden={activeTab !== 'owned'}
      >
        {mountedTabs.owned && (
          <TabErrorBoundary
            tabName="owned"
            title={TEXTS.notice[language]}
            message={TEXTS.noData[language]}
            retryLabel={TEXTS.ok[language]}
            accentClassName={themeColors.primary}
          >
            <OwnedTabContainer
              items={ownedItems}
              theme={theme}
              language={language}
              statuses={statuses}
              aiEnabled={aiEnabled}
              isActive={activeTab === 'owned'}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onAddUsage={handleAddUsage}
              onRequestImage={getResolvedItemImage}
              onPreviewImage={openImagePreview}
              onOpenAdd={handleOpenAdd}
            />
          </TabErrorBoundary>
        )}
      </div>

      <div
        className={mountedTabs.wishlist ? (activeTab === 'wishlist' ? 'block' : 'hidden') : 'hidden'}
        aria-hidden={activeTab !== 'wishlist'}
      >
        {mountedTabs.wishlist && (
          <TabErrorBoundary
            tabName="wishlist"
            title={TEXTS.notice[language]}
            message={TEXTS.noData[language]}
            retryLabel={TEXTS.ok[language]}
            accentClassName={themeColors.primary}
          >
            <WishlistTabContainer
              items={wishlistItems}
              theme={theme}
              language={language}
              categories={categories}
              aiEnabled={aiEnabled}
              isActive={activeTab === 'wishlist'}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onAddUsage={handleAddUsage}
              onRequestImage={getResolvedItemImage}
              onPreviewImage={openImagePreview}
              onOpenAdd={handleOpenAdd}
            />
          </TabErrorBoundary>
        )}
      </div>

      <div
        className={mountedTabs.stats ? (activeTab === 'stats' ? 'block' : 'hidden') : 'hidden'}
        aria-hidden={activeTab !== 'stats'}
      >
        {mountedTabs.stats && (
          <TabErrorBoundary
            tabName="stats"
            title={TEXTS.notice[language]}
            message={TEXTS.noData[language]}
            retryLabel={TEXTS.ok[language]}
            accentClassName={themeColors.primary}
          >
            <StatsTabContainer
              items={items}
              categories={categories}
              channels={channels}
              theme={theme}
              language={language}
              isActive={activeTab === 'stats'}
              formatNumber={formatNumber}
              toNumber={toNumber}
            />
          </TabErrorBoundary>
        )}
      </div>

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-6 right-6 h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl rounded-full z-30 flex items-center justify-around px-2 border border-white/50 dark:border-slate-800/50 transition-colors">
        <button 
            onClick={() => handleChangeTab('owned')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'owned' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'owned' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.Home size={22} strokeWidth={activeTab === 'owned' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabOwned[language]}</span>
        </button>
        
        <button 
            onClick={() => handleChangeTab('wishlist')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'wishlist' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'wishlist' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.Heart size={22} strokeWidth={activeTab === 'wishlist' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabWishlist[language]}</span>
        </button>

        <button 
            onClick={() => handleChangeTab('stats')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'stats' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'stats' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.PieChart size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabStats[language]}</span>
        </button>

        <button 
            onClick={() => handleChangeTab('profile')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'profile' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'profile' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabMine[language]}</span>
        </button>
      </div>

      {dialog && (
        <Suspense fallback={null}>
        <Dialog
          isOpen={true}
          type={dialog.type}
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          cancelText={dialog.cancelText}
          theme={theme}
          defaultValue={dialog.defaultValue}
          placeholder={dialog.placeholder}
          onConfirm={dialog.onConfirm}
          onCancel={dialog.onCancel}
        />
        </Suspense>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={handleCloseImagePreview}
        >
          <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleCloseImagePreview}
              className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white/90 text-gray-700 shadow-lg flex items-center justify-center"
            >
              <ICONS.X size={18} />
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.name || 'Preview'}
              className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            {previewImage.name && (
              <div className="mt-3 text-center text-xs text-white/80">{previewImage.name}</div>
            )}
          </div>
        </div>
      )}

      <Suspense fallback={null}>
      <AddItemModal 
        isOpen={isAddModalOpen} 
        onClose={handleCloseModal}
        onSave={handleSaveItem}
        onDelete={deleteItemById}
        onAlert={openAlert}
        onConfirm={openConfirm}
        language={language}
        theme={theme}
        aiConfig={activeAiConfig}
        aiEnabled={aiEnabled}
        activeTab={activeTab === 'wishlist' ? 'wishlist' : 'owned'}
        initialItem={editingItem}
        initialMode={initialAddMode}
        categories={categories}
        statuses={statuses}
        channels={channels}
      />
      </Suspense>
    </div>
  );
};

export default App;













