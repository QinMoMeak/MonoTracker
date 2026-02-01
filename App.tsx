import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { AiConfig, AiCredentials, AiProvider, AiRuntimeConfig, Item, Language, ThemeColor, Tab, AppearanceMode, WebDavConfig, RestoreMode } from './types';
import { THEMES, TEXTS, ICONS, INITIAL_ITEMS, CATEGORY_CONFIG, DEFAULT_CHANNELS, DEFAULT_STATUSES } from './constants';
import { loadState, saveState, exportCSV } from './services/storageService';
import { buildExportZip, importBackupFile } from './services/backupService';
import { deleteWebDav, downloadWebDav, existsWebDav, uploadWebDav } from './services/webdavService';
import { AI_PROVIDERS, getModelMeta, getProviderMeta, getProviderModels } from './services/aiProviders';
import Timeline from './components/Timeline';
import AddItemModal from './components/AddItemModal';
import Dialog from './components/Dialog';
import SheetModal from './components/SheetModal';
const StatsTab = lazy(() => import('./components/StatsTab'));

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
  const [showDataManageModal, setShowDataManageModal] = useState(false);
  const [showWebdavModal, setShowWebdavModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; name?: string } | null>(null);
  
  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState('');
  
  // Generic filter state: 'all' or specific value (status for owned, category for wishlist)
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [topN, setTopN] = useState(5);
  
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

  const currencySymbol = '\u00a5';

  const t = (key: string, fallback: string = key) =>
    (TEXTS as any)?.[key]?.[language]
    ?? (TEXTS as any)?.[key]?.['zh-CN']
    ?? (TEXTS as any)?.[key]?.['en']
    ?? fallback;

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
      if (mode === 'overwrite') {
        const normalized = newItems.map(raw => normalizeItem(raw as Item));
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

  const fetchWebDavHistory = async (config: WebDavConfig) => {
    const manifest = await readWebDavManifest(config);
    const history = manifest?.history || [];
    const readyChecks = await Promise.all(history.map(async (entry) => {
      const ready = await existsWebDav(config, entry.readyPath).catch(() => false);
      return ready ? entry : null;
    }));
    return readyChecks.filter(Boolean) as WebDavManifestEntry[];
  };

  const refreshWebDavHistory = async () => {
    const { serverUrl, username, password } = webdavConfig;
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      setWebdavHistory([]);
      setSelectedWebdavBackupId('');
      setWebdavHistoryLoading(false);
      return [];
    }
    if (!Capacitor.isNativePlatform()) {
      setWebdavHistory([]);
      setSelectedWebdavBackupId('');
      setWebdavHistoryLoading(false);
      return [];
    }
    setWebdavHistoryLoading(true);
    try {
      const readyHistory = await fetchWebDavHistory(webdavConfig);
      const display = readyHistory.slice(0, 3);
      setWebdavHistory(display);
      setSelectedWebdavBackupId(prev =>
        display.some(entry => entry.id === prev) ? prev : (display[0]?.id || '')
      );
      return display;
    } catch (e) {
      console.warn('WebDAV history load failed:', e);
      setWebdavHistory([]);
      setSelectedWebdavBackupId('');
      return [];
    } finally {
      setWebdavHistoryLoading(false);
    }
  };

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

  const normalizeItem = (item: Item): Item => {
    const safePrice = toNumber(item.price);
    const safeMsrp = toNumber(item.msrp);
    const safeUsage = toNumber(item.usageCount);
    const safeQuantity = Math.max(1, Math.floor(toNumber((item as any).quantity) || 1));
    const computedAvg = safeQuantity > 0 ? Number((safePrice / safeQuantity).toFixed(2)) : safePrice;
    const safeAvg = toNumber((item as any).avgPrice) || computedAvg;
    const id = item.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
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
      purchaseDate: normalizeDate(item.purchaseDate)
    };
  };

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

  const getChannelLabel = useCallback(
    (channel: string) => channelLabelMap.get(channel) || channel,
    [channelLabelMap]
  );

  const normalizeChannelValue = useCallback(
    (value?: string) => {
      if (!value) return value;
      return channelLabelToKeyMap.get(value) || value;
    },
    [channelLabelToKeyMap]
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

      if (loaded.items) {
          const migratedItems = loaded.items.map(normalizeItem).map(i => ({
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
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    SplashScreen.hide().catch(() => {});
  }, [isLoaded]);

  // --- Persistence ---
  useEffect(() => {
    // Prevent saving if we haven't loaded yet to avoid overwriting with initial empty state
    if (!isLoaded) return;

    void saveState({ items, language, theme, appearance, aiConfig, categories, statuses, channels, webdav: webdavConfig, autoBackupEnabled, lastBackupLocalDate, webdavIncludeImages, webdavRestoreMode });
  }, [items, language, theme, appearance, aiConfig, categories, statuses, channels, webdavConfig, autoBackupEnabled, lastBackupLocalDate, webdavIncludeImages, webdavRestoreMode, isLoaded]);

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

  const closeDataManageModal = () => {
    setShowDataManageModal(false);
  };

  const closeWebdavModal = () => {
    setShowWebdavModal(false);
  };

  useEffect(() => {
    if (!showWebdavModal) return;
    void refreshWebDavHistory();
  }, [showWebdavModal]);

  const openImagePreview = useCallback((src: string, name?: string) => {
    if (!src) return;
    setPreviewImage({ src, name });
    window.history.pushState(null, '', '');
  }, []);

  const closeImagePreview = () => {
    setPreviewImage(null);
  };

  const handleCloseImagePreview = () => {
    window.history.back();
  };

  // --- History Handling (Back Gesture) ---
  useEffect(() => {
    const handlePopState = () => {
      // If modal is open and user presses back, close it
      if (previewImage) {
        closeImagePreview();
        return;
      }
      if (isAddModalOpen) {
        closeAddModal();
      }
      if (showExportModal) {
          closeExportModal();
      }
      if (showAiSettingsModal) {
          closeAiSettingsModal();
      }
      if (showDataManageModal) {
          closeDataManageModal();
      }
      if (showWebdavModal) {
          closeWebdavModal();
      }
    };

    if (previewImage || isAddModalOpen || showExportModal || showAiSettingsModal || showDataManageModal || showWebdavModal) {
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [previewImage, isAddModalOpen, showExportModal, showAiSettingsModal, showDataManageModal, showWebdavModal]);

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

    autoBackupInFlight.current = true;
    buildExportZip(items, undefined, webdavIncludeImages)
      .then(async ({ blob }) => {
        const id = buildBackupId();
        const entry = await createSnapshotEntry(blob, id);
        await commitSnapshot(webdavConfig, entry, blob);
        setLastBackupLocalDate(today);
        await refreshWebDavHistory();
        setSelectedWebdavBackupId(entry.id);
      })
      .catch(err => console.error('Auto WebDAV backup failed', err))
      .finally(() => {
        autoBackupInFlight.current = false;
      });
  }, [isLoaded, autoBackupEnabled, webdavConfig, items, lastBackupLocalDate, webdavIncludeImages]);

  useEffect(() => {
    let backHandle: { remove: () => void } | undefined;
    const handler = ({ canGoBack }: { canGoBack: boolean }) => {
      if (dialog) {
        setDialog(null);
        return;
      }
      if (previewImage) {
        window.history.back();
        return;
      }
      if (isAddModalOpen || showExportModal || showAiSettingsModal || showDataManageModal || showWebdavModal) {
        window.history.back();
        return;
      }
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    };

    CapacitorApp.addListener('backButton', handler).then(handle => {
      backHandle = handle;
    });

    return () => {
      backHandle?.remove();
    };
  }, [dialog, previewImage, isAddModalOpen, showExportModal, showAiSettingsModal, showDataManageModal, showWebdavModal]);

  useEffect(() => {
    const handleBackButton = (event: Event) => {
      if (dialog) {
        event.preventDefault();
        setDialog(null);
        return;
      }
      if (previewImage) {
        event.preventDefault();
        window.history.back();
        return;
      }
      if (isAddModalOpen || showExportModal || showAiSettingsModal || showDataManageModal || showWebdavModal) {
        event.preventDefault();
        window.history.back();
      }
    };

    document.addEventListener('backbutton', handleBackButton);
    return () => {
      document.removeEventListener('backbutton', handleBackButton);
    };
  }, [dialog, previewImage, isAddModalOpen, showExportModal, showAiSettingsModal, showDataManageModal, showWebdavModal]);

  // Reset filter on tab change
  useEffect(() => {
    setActiveFilter('all');
    setSearchQuery('');
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterPriceMin('');
    setFilterPriceMax('');
    setShowAdvancedFilters(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeFilter === 'all') return;
    if (activeTab === 'owned' && !statuses.includes(activeFilter)) {
      setActiveFilter('all');
    }
    if (activeTab === 'wishlist' && !categories.includes(activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, activeTab, categories, statuses]);

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
  const handleSaveItem = (itemData: Partial<Item>) => {
    if (itemData.id) {
        // Edit existing item
        setItems(prev => prev.map(i => {
          if (i.id !== itemData.id) return i;
          const nextPrice = itemData.price ?? i.price ?? 0;
          const nextQty = Math.max(1, Math.floor(toNumber((itemData.quantity ?? i.quantity) as any) || 1));
          const nextAvg = itemData.avgPrice ?? Number((nextPrice / nextQty).toFixed(2));
          return { ...i, ...itemData, quantity: nextQty, avgPrice: nextAvg } as Item;
        }));
    } else {
        // Create new item
        const quantity = Math.max(1, Math.floor(toNumber(itemData.quantity as any) || 1));
        const price = itemData.price || 0;
        const avgPrice = itemData.avgPrice ?? Number((price / quantity).toFixed(2));
        const newItem: Item = {
            id: Date.now().toString(),
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
            usageCount: itemData.usageCount || 0,
            discountRate: itemData.discountRate,
            channel: itemData.channel,
            priceHistory: itemData.priceHistory || [],
            valueDisplay: itemData.valueDisplay || 'both'
        };
        setItems(prev => [newItem, ...prev]);
    }
    closeAddModal();
    // Go back in history to close modal (triggers popstate listener)
    window.history.back();
  };

  const handleEditItem = useCallback((item: Item) => {
      setEditingItem(item);
      setInitialAddMode('manual');
      setIsAddModalOpen(true);
      // Push state to allow back button to close modal
      window.history.pushState(null, '', '');
  }, []);

  const handleOpenAdd = (mode: 'ai' | 'manual') => {
      setEditingItem(null);
      setInitialAddMode(aiEnabled ? mode : 'manual');
      setIsAddModalOpen(true);
      // Push state to allow back button to close modal
      window.history.pushState(null, '', '');
  };

  const handleCloseModal = () => {
      // Go back in history (triggers popstate listener to close modal)
      window.history.back();
  };

  const handleOpenAiSettings = () => {
      setShowAiSettingsModal(true);
      window.history.pushState(null, '', '');
  };

  const handleCloseAiSettings = () => {
      window.history.back();
  };

  const handleOpenDataManage = () => {
      setShowDataManageModal(true);
      window.history.pushState(null, '', '');
  };

  const handleCloseDataManage = () => {
      window.history.back();
  };

  const handleOpenWebdav = () => {
      setShowWebdavModal(true);
      window.history.pushState(null, '', '');
  };

  const handleCloseWebdav = () => {
      window.history.back();
  };

  const handleDeleteItem = async (id: string) => {
    const confirmed = await openConfirm(TEXTS.deleteConfirm[language]);
    if (confirmed) deleteItemById(id);
  };

  const deleteItemById = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleAddUsage = useCallback((item: Item) => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, usageCount: (i.usageCount || 0) + 1 } : i));
  }, []);

  const handleClearFilters = () => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterPriceMin('');
    setFilterPriceMax('');
  };


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
      window.history.pushState(null, '', '');
  };

  const handleCloseExportModal = () => {
      window.history.back();
  };

    const executeFileSave = async () => {
      const csvContent = exportData || `\ufeff${exportCSV(items)}`;
      const { fileName, blob, base64 } = await buildExportZip(items, csvContent);

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
          setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      const { fileName, blob, base64 } = await buildExportZip(items, csvContent);

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
      const normalized = normalizeItem(raw as Item);
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
          const normalized = normalizeItem(raw as Item);
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
      await openAlert(t('webdavMissing', 'WebDAV ?????'));
      return;
    }

    try {
      const csvContent = `﻿${exportCSV(items)}`;
      const { blob } = await buildExportZip(items, csvContent, webdavIncludeImages);
      if (!shouldCommitBackup(items.length)) {
        await openAlert(t('webdavUploadFailed', 'WebDAV ????'));
        return;
      }
      const id = buildBackupId();
      const entry = await createSnapshotEntry(blob, id);
      await commitSnapshot(webdavConfig, entry, blob);
      setLastBackupLocalDate(getLocalDateKey());
      await refreshWebDavHistory();
      setSelectedWebdavBackupId(entry.id);
      await openAlert(t('webdavUploadSuccess', 'WebDAV ????'));
    } catch (e) {
      console.warn('WebDAV upload failed:', e);
      await openAlert(t('webdavUploadFailed', 'WebDAV ????'));
    }
  };

  const handleWebDavDownload = async () => {
    const { serverUrl, username, password } = webdavConfig;
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      await openAlert(t('webdavMissing', 'WebDAV ?????'));
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
      if (restored) {
        await openAlert(t('webdavDownloadSuccess', 'WebDAV ????'));
        return;
      }

      await openAlert(t('webdavDownloadFailed', 'WebDAV ????'));
    } catch (e) {
      console.warn('WebDAV download failed:', e);
      await openAlert(t('webdavDownloadFailed', 'WebDAV ????'));
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
  
  // 1. First filter by tab
  const tabItems = useMemo(() => items.filter(i => {
      if (activeTab === 'profile' || activeTab === 'stats') return true;
      return i.type === activeTab;
  }), [items, activeTab]);

  // 2. Compute available filter options based on tab
  const availableFilters = useMemo(() => {
    if (activeTab === 'profile' || activeTab === 'stats') return [];
    
    const options = new Set<string>();

    if (activeTab === 'owned') {
        // For Owned: Filter by Status
        statuses.forEach(s => options.add(s));
        tabItems.forEach(i => {
            if (i.status) options.add(i.status);
        });
    } else if (activeTab === 'wishlist') {
        // For Wishlist: Filter by Category
        categories.forEach(c => options.add(c));
        tabItems.forEach(i => {
            if (i.category) options.add(i.category);
        });
    }
    
    return Array.from(options);
  }, [tabItems, activeTab, categories, statuses]);

  // 3. Filter by selected option
  const finalDisplayItems = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      const minPrice = filterPriceMin ? parseFloat(filterPriceMin) : null;
      const maxPrice = filterPriceMax ? parseFloat(filterPriceMax) : null;

      return tabItems.filter(item => {
        if (activeFilter !== 'all') {
          if (activeTab === 'owned' && item.status !== activeFilter) return false;
          if (activeTab === 'wishlist' && item.category !== activeFilter) return false;
        }

        if (query) {
          const channelLabel = item.channel ? getChannelLabel(item.channel) : '';
          const haystack = [
            item.name,
            item.note,
            item.link,
            item.storeName,
            item.channel,
            channelLabel,
            item.status,
            item.category
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }

        if (filterDateStart && item.purchaseDate < filterDateStart) return false;
        if (filterDateEnd && item.purchaseDate > filterDateEnd) return false;

        if (minPrice !== null && !Number.isNaN(minPrice) && item.price < minPrice) return false;
        if (maxPrice !== null && !Number.isNaN(maxPrice) && item.price > maxPrice) return false;

        return true;
      });
  }, [
      tabItems,
      activeFilter,
      activeTab,
      searchQuery,
      filterDateStart,
      filterDateEnd,
      filterPriceMin,
      filterPriceMax,
      getChannelLabel
  ]);
  
  const ownedItems = useMemo(() => items.filter(i => i.type === 'owned'), [items]);
  const totalValue = useMemo(() => ownedItems.reduce((acc, curr) => acc + curr.price, 0), [ownedItems]);

  // --- STATISTICS CALCULATIONS ---
  const stats = useMemo(() => {
    const totalCount = ownedItems.length;
    const totalVal = ownedItems.reduce((acc, i) => acc + i.price, 0);
    const channelLabelFallback = TEXTS.channelUnknown[language];
    
    // Category Stats (Value & Count)
    // Gather all unique categories (both config and custom)
    const allCats = new Set([...categories, ...ownedItems.map(i => i.category)]);
    
    const catStats = Array.from(allCats).map(cat => {
        const catItems = ownedItems.filter(i => (i.category || 'other') === cat);
        const val = catItems.reduce((acc, i) => acc + i.price, 0);
        return {
            cat,
            count: catItems.length,
            value: val,
            percentVal: totalVal > 0 ? (val / totalVal) * 100 : 0,
            percentCount: totalCount > 0 ? (catItems.length / totalCount) * 100 : 0
        };
    }).filter(s => s.count > 0);

    const catStatsByValue = [...catStats].sort((a, b) => b.value - a.value);
    const catStatsByCount = [...catStats].sort((a, b) => b.count - a.count);

    // Status Stats
    const statusMap = new Map<string, number>();
    ownedItems.forEach(i => {
        const s = i.status || 'unknown';
        statusMap.set(s, (statusMap.get(s) || 0) + 1);
    });
    const statusStats = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
        percent: totalCount > 0 ? (count / totalCount) * 100 : 0
    })).sort((a, b) => b.count - a.count);

    // Duration Stats
    // Buckets: <1M, 1-6M, 6-12M, 1-3Y, >3Y
    const now = new Date().getTime();
    const dayMs = 1000 * 60 * 60 * 24;
    const durationBuckets: Record<string, number> = {
        '<1M': 0,
        '1-6M': 0,
        '6-12M': 0,
        '1-3Y': 0,
        '>3Y': 0
    };
    
    ownedItems.forEach(i => {
        const raw = new Date(i.purchaseDate).getTime();
        const pDate = Number.isFinite(raw) ? raw : now;
        const days = (now - pDate) / dayMs;
        if (days < 30) durationBuckets['<1M']++;
        else if (days < 180) durationBuckets['1-6M']++;
        else if (days < 365) durationBuckets['6-12M']++;
        else if (days < 1095) durationBuckets['1-3Y']++;
        else durationBuckets['>3Y']++;
    });

    // Timeline Data (sorted by date, highlighting status)
    const timelineData = [...ownedItems].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    // Monthly Spend Trend
    const monthMap = new Map<string, number>();
    ownedItems.forEach(item => {
      if (!item.purchaseDate) return;
      const monthKey = item.purchaseDate.slice(0, 7);
      const amount = toNumber(item.price);
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + amount);
    });
    const monthlySpend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({ month, value }));

    // Channel Spend Trend
    const channelMap = new Map<string, { value: number; count: number }>();
    ownedItems.forEach(item => {
      const rawChannel = item.channel?.trim();
      const key = rawChannel ? normalizeChannelValue(rawChannel) : channelLabelFallback;
      const current = channelMap.get(key) || { value: 0, count: 0 };
      channelMap.set(key, { value: current.value + item.price, count: current.count + 1 });
    });
    const channelStats = Array.from(channelMap.entries())
      .map(([channel, data]) => ({
        channel,
        value: data.value,
        count: data.count,
        percentVal: totalVal > 0 ? (data.value / totalVal) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    return { totalCount, totalVal, catStatsByValue, catStatsByCount, statusStats, durationBuckets, timelineData, monthlySpend, channelStats };
  }, [ownedItems, categories, normalizeChannelValue]);


  // Helper for localized status label
  const getStatusLabel = (s: string) => {
     if (s === 'new') return TEXTS.statusNew[language];
     if (s === 'used') return TEXTS.statusUsed[language];
     if (s === 'broken') return TEXTS.statusBroken[language];
     if (s === 'sold') return TEXTS.statusSold[language];
     if (s === 'emptied') return TEXTS.statusEmptied[language];
     return s;
  };

  // Helper for localized category label
  const getCategoryLabel = (c: string) => {
      const config = CATEGORY_CONFIG[c];
      return config ? TEXTS[config.labelKey][language] : c;
  };

  // Generic Label Getter
  const getFilterLabel = (val: string) => {
      if (activeTab === 'owned') return getStatusLabel(val);
      if (activeTab === 'wishlist') return getCategoryLabel(val);
      return val;
  };

  // Helper to get Icon for Category Filter
  const getFilterIcon = (val: string) => {
      if (activeTab === 'wishlist') {
          const config = CATEGORY_CONFIG[val];
          return config ? config.icon : null;
      }
      return null;
  };

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
                <span className="text-4xl font-light">{currencySymbol}{formatNumber(totalValue)}</span>
                <span className="text-sm opacity-60 uppercase tracking-widest font-semibold">{TEXTS.totalValue[language]}</span>
            </div>
        ) : null}
      </div>

      {/* STATISTICS TAB */}
      {activeTab === 'stats' && (
        <Suspense fallback={<div className="p-6 pb-32"></div>}>
          <StatsTab
            stats={stats}
            language={language}
            TEXTS={TEXTS}
            ICONS={ICONS}
            CATEGORY_CONFIG={CATEGORY_CONFIG}
            themeColors={themeColors}
            currencySymbol={currencySymbol}
            formatNumber={formatNumber}
            toNumber={toNumber}
            getStatusLabel={getStatusLabel}
            getCategoryLabel={getCategoryLabel}
            getChannelLabel={getChannelLabel}
            topN={topN}
            onTopNChange={setTopN}
          />
        </Suspense>
      )}

      {/* PROFILE TAB (Simplified) */}
      {activeTab === 'profile' && (
        <div className="p-6 space-y-6 pb-32">
          {/* Quick Access */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 shadow-sm space-y-3 transition-colors">
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
                    onClick={() => setLanguage(l)}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${language === l ? `${themeColors.primary} text-white shadow-md` : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}
                  >
                    {l === 'zh-CN' ? '简体中文' : l === 'zh-TW' ? '繁體中文' : l === 'en' ? 'English' : '日本語'}
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

      <SheetModal
        isOpen={showAiSettingsModal}
        title={TEXTS.aiSettings[language]}
        theme={theme}
        onClose={handleCloseAiSettings}
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold opacity-50 mb-3 uppercase">{TEXTS.aiProvider[language]}</p>
            <div className="grid grid-cols-2 gap-2">
              {AI_PROVIDERS.map(provider => {
                const isSelected = aiConfig.provider === provider.id;
                return (
                  <button
                    key={provider.id}
                    onClick={() => handleSelectProvider(provider.id)}
                    className={`py-3 rounded-xl text-xs font-semibold transition-all ${
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

      {/* OWNED / WISHLIST VIEWS */}
      {(activeTab === 'owned' || activeTab === 'wishlist') && (
        <>
            {/* Search & Advanced Filters */}
            <div className="px-6 mb-3 space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <ICONS.Search size={16} className="absolute left-4 top-4 text-gray-400" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={TEXTS.searchPlaceholder[language]}
                            className="w-full p-4 pl-10 bg-white dark:bg-slate-900 dark:text-white rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowAdvancedFilters(prev => !prev)}
                        className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-semibold flex items-center gap-2"
                    >
                        <ICONS.SlidersHorizontal size={16} />
                        {TEXTS.advancedFilter[language]}
                    </button>
                </div>

                {showAdvancedFilters && (
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-[10px] font-semibold text-gray-400 ml-1 mb-1 block uppercase">{TEXTS.dateStart[language]}</label>
                              <input
                                  type="date"
                                  value={filterDateStart}
                                  onChange={(e) => setFilterDateStart(e.target.value)}
                                  className="w-full p-3 bg-white dark:bg-slate-800 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 [color-scheme:light] dark:[color-scheme:dark]"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-semibold text-gray-400 ml-1 mb-1 block uppercase">{TEXTS.dateEnd[language]}</label>
                              <input
                                  type="date"
                                  value={filterDateEnd}
                                  onChange={(e) => setFilterDateEnd(e.target.value)}
                                  className="w-full p-3 bg-white dark:bg-slate-800 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 [color-scheme:light] dark:[color-scheme:dark]"
                              />
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-[10px] font-semibold text-gray-400 ml-1 mb-1 block uppercase">{TEXTS.priceMin[language]}</label>
                              <input
                                  type="number"
                                  value={filterPriceMin}
                                  onChange={(e) => setFilterPriceMin(e.target.value)}
                                  className="w-full p-3 bg-white dark:bg-slate-800 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700"
                              />
                          </div>
                          <div>
                              <label className="text-[10px] font-semibold text-gray-400 ml-1 mb-1 block uppercase">{TEXTS.priceMax[language]}</label>
                              <input
                                  type="number"
                                  value={filterPriceMax}
                                  onChange={(e) => setFilterPriceMax(e.target.value)}
                                  className="w-full p-3 bg-white dark:bg-slate-800 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700"
                              />
                          </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleClearFilters}
                          className="text-xs font-semibold text-gray-500 dark:text-gray-300 px-3 py-2 rounded-full bg-gray-100 dark:bg-slate-800"
                        >
                          {TEXTS.clearFilter[language]}
                        </button>
                      </div>
                  </div>
                )}
            </div>

            {/* Filter Chips (Dynamic: Status for Owned, Category for Wishlist) */}
            <div className="px-6 mb-2">
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            activeFilter === 'all'
                            ? `${themeColors.primary} text-white shadow-md`
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {TEXTS.filterAll[language]}
                    </button>
                    {availableFilters.map(filterVal => {
                        const FilterIcon = getFilterIcon(filterVal);
                        return (
                            <button
                                key={filterVal}
                                onClick={() => setActiveFilter(filterVal)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    activeFilter === filterVal
                                    ? `${themeColors.primary} text-white shadow-md`
                                    : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                {FilterIcon && <FilterIcon size={12} />}
                                {getFilterLabel(filterVal)}
                            </button>
                        );
                    })}
                </div>
            </div>

            <Timeline 
              items={finalDisplayItems} 
              theme={theme} 
              language={language}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onAddUsage={handleAddUsage}
              onPreviewImage={openImagePreview}
            />
        </>
      )}

      {/* Floating Action Buttons (Split) - Hide on Profile and Stats tab */}
      {(activeTab === 'owned' || activeTab === 'wishlist') && (
        <div className="fixed right-6 bottom-28 z-40 flex flex-col items-end gap-4 pointer-events-none">
            {/* Manual Add - Secondary (Only show if AI is enabled) */}
            {aiEnabled && (
                <div className="flex items-center gap-2 pointer-events-auto">
                <button
                    onClick={() => handleOpenAdd('manual')}
                    className="flex items-center justify-center w-14 h-14 rounded-[1.5rem] shadow-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 transition-transform hover:scale-105 active:scale-95 border border-gray-100 dark:border-slate-700"
                >
                    <ICONS.Edit3 size={24} />
                </button>
                </div>
            )}

            {/* Primary Add Button (Acts as AI if enabled, or Manual if AI disabled) */}
            <div className="flex items-center gap-2 pointer-events-auto">
                <button
                    onClick={() => handleOpenAdd(aiEnabled ? 'ai' : 'manual')}
                    className={`flex items-center justify-center w-14 h-14 rounded-[1.5rem] shadow-xl text-white transition-transform hover:scale-105 active:scale-95 ${themeColors.primary}`}
                >
                    {aiEnabled ? <ICONS.Sparkles size={24} /> : <ICONS.Plus size={28} />}
                </button>
            </div>
        </div>
      )}

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-6 right-6 h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl rounded-full z-30 flex items-center justify-around px-2 border border-white/50 dark:border-slate-800/50 transition-colors">
        <button 
            onClick={() => setActiveTab('owned')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'owned' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'owned' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.Home size={22} strokeWidth={activeTab === 'owned' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabOwned[language]}</span>
        </button>
        
        <button 
            onClick={() => setActiveTab('wishlist')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'wishlist' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'wishlist' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.Heart size={22} strokeWidth={activeTab === 'wishlist' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabWishlist[language]}</span>
        </button>

        <button 
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'stats' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'stats' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.PieChart size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabStats[language]}</span>
        </button>

        <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'profile' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'profile' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            </div>
            <span className="text-[9px] font-bold">{TEXTS.tabMine[language]}</span>
        </button>
      </div>

      {dialog && (
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
    </div>
  );
};

export default App;



























