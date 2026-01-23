import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { AiConfig, AiCredentials, AiProvider, AiRuntimeConfig, Item, Language, ThemeColor, Tab, AppearanceMode } from './types';
import { THEMES, TEXTS, ICONS, INITIAL_ITEMS, CATEGORY_CONFIG, DEFAULT_CHANNELS, DEFAULT_STATUSES } from './constants';
import { loadState, saveState, importCSV, exportCSV } from './services/storageService';
import { AI_PROVIDERS, getModelMeta, getProviderMeta, getProviderModels } from './services/aiProviders';
import Timeline from './components/Timeline';
import AddItemModal from './components/AddItemModal';
import Dialog from './components/Dialog';
import SheetModal from './components/SheetModal';

// Define the custom Export Plugin interface
interface ExportPluginInterface {
  exportData(options: { content: string, fileName: string, mimeType: string }): Promise<{ uri: string }>;
}

// Register the plugin (assumes it is implemented on the native side)
const ExportPlugin = registerPlugin<ExportPluginInterface>('ExportPlugin');

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
    const loaded = loadState();
    if (loaded.items) {
        // Migration: Ensure category exists
        const migratedItems = loaded.items.map(i => ({
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

    const fallbackProvider: AiProvider = (loaded as any).showAiFab === false ? 'disabled' : 'gemini';
    setAiConfig(buildAiConfig(loaded.aiConfig || {}, fallbackProvider));
    
    // Mark as loaded to enable saving
    setIsLoaded(true);
  }, []);

  // --- Persistence ---
  useEffect(() => {
    // Prevent saving if we haven't loaded yet to avoid overwriting with initial empty state
    if (!isLoaded) return;

    saveState({ items, language, theme, appearance, aiConfig, categories, statuses, channels });
  }, [items, language, theme, appearance, aiConfig, categories, statuses, channels, isLoaded]);

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

  // --- History Handling (Back Gesture) ---
  useEffect(() => {
    const handlePopState = () => {
      // If modal is open and user presses back, close it
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
    };

    if (isAddModalOpen || showExportModal || showAiSettingsModal || showDataManageModal) {
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAddModalOpen, showExportModal, showAiSettingsModal, showDataManageModal]);

  useEffect(() => {
    let backHandle: { remove: () => void } | undefined;
    const handler = ({ canGoBack }: { canGoBack: boolean }) => {
      if (dialog) {
        setDialog(null);
        return;
      }
      if (isAddModalOpen || showExportModal || showAiSettingsModal || showDataManageModal) {
        window.history.back();
        return;
      }
      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    };

    backHandle = CapacitorApp.addListener('backButton', handler);

    return () => {
      backHandle?.remove();
    };
  }, [dialog, isAddModalOpen, showExportModal, showAiSettingsModal, showDataManageModal]);

  useEffect(() => {
    const handleBackButton = (event: Event) => {
      if (dialog) {
        event.preventDefault();
        setDialog(null);
        return;
      }
      if (isAddModalOpen || showExportModal || showAiSettingsModal || showDataManageModal) {
        event.preventDefault();
        window.history.back();
      }
    };

    document.addEventListener('backbutton', handleBackButton);
    return () => {
      document.removeEventListener('backbutton', handleBackButton);
    };
  }, [dialog, isAddModalOpen, showExportModal, showAiSettingsModal, showDataManageModal]);

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
        setItems(prev => prev.map(i => i.id === itemData.id ? { ...i, ...itemData } as Item : i));
    } else {
        // Create new item
        const newItem: Item = {
            id: Date.now().toString(),
            type: (itemData.type as any) || (activeTab === 'wishlist' ? 'wishlist' : 'owned'),
            name: itemData.name || 'Unknown Item',
            price: itemData.price || 0,
            msrp: itemData.msrp || itemData.price || 0,
            purchaseDate: itemData.purchaseDate || new Date().toISOString().split('T')[0],
            currency: 'CNY',
            status: (itemData.status as any) || 'new',
            category: (itemData.category as any) || 'other',
            note: itemData.note || '',
            link: itemData.link || '',
            image: itemData.image,
            usageCount: itemData.usageCount || 0,
            discountRate: itemData.discountRate,
            channel: itemData.channel,
            priceHistory: itemData.priceHistory || []
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
      setActiveFilter('all');
      setSearchQuery('');
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

  const buildExportFileName = () =>
    `monotracker_backup_${new Date().toISOString().split('T')[0]}.csv`;

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
      const fileName = buildExportFileName();
      const triggerDownload = (href: string) => {
          const link = document.createElement('a');
          link.href = href;
          link.setAttribute('download', fileName);
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      };

      // Strategy -1: Capacitor Native Plugin (Highest Priority)
      try {
          // Attempt to use the registered Capacitor plugin
          const result = await ExportPlugin.exportData({
              content: exportData,
              fileName: fileName,
              mimeType: 'text/csv'
          });
          console.log('Export success via Capacitor:', result.uri);
          await openAlert(TEXTS.exportSuccess[language]);
          return; // Stop here if native export works
      } catch (error: any) {
          console.warn('Capacitor export failed or not available:', error);
          // If error is "User cancelled", stop. Otherwise, fall through to other methods.
          if (error.message === 'User cancelled export') return;
      }

      // Strategy 0: Native Filesystem (Capacitor)
      if (Capacitor.isNativePlatform()) {
          try {
              const permissionOk = await ensurePublicStoragePermission();
              if (!permissionOk) {
                  await openAlert(TEXTS.saveFailed[language]);
                  return;
              }
              const result = await Filesystem.writeFile({
                  path: fileName,
                  data: exportData,
                  directory: Directory.Documents,
                  encoding: Encoding.UTF8
              });
              console.log('Export success via Filesystem:', result.uri);
              await openAlert(TEXTS.exportSuccess[language]);
              return;
          } catch (error) {
              console.warn('Filesystem export failed:', error);
          }
      }
      
      // Strategy 1: Legacy Android Bridge (JSBridge - direct window injection)
      if (window.Android && window.Android.saveCSV) {
          try {
              window.Android.saveCSV(exportData, fileName);
              return; 
          } catch (e) {
              console.error("Native bridge failed, falling back to web methods", e);
          }
      }

      // Strategy 2: File System Access API (Native "Save As" intent if supported by browser)
      try {
          if (window.showSaveFilePicker) {
              const handle = await window.showSaveFilePicker({
                  suggestedName: fileName,
                  types: [{
                      description: 'CSV File',
                      accept: { 'text/csv': ['.csv'] },
                  }],
              });
              const writable = await handle.createWritable();
              await writable.write(exportData);
              await writable.close();
              return; // Success
          }
      } catch (err) {
          console.warn('FileSystem API failed or cancelled:', err);
          // Fall through to legacy method
      }

      // Strategy 3: Blob URL Download (works in most mobile browsers)
      try {
          const blob = new Blob([exportData], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          triggerDownload(url);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return;
      } catch (e) {
          console.warn('Blob download failed:', e);
      }

      // Strategy 4: Data URI Download (Bypasses Blob Registry restrictions in some WebViews)
      try {
          // Use Base64 to ensure encoding is preserved across strict boundaries
          const base64Content = btoa(unescape(encodeURIComponent(exportData)));
          const dataUri = `data:text/csv;base64,${base64Content}`;
          triggerDownload(dataUri);
      } catch (e) {
          console.error('Data URI download failed:', e);
          await openAlert(TEXTS.saveFailed[language]);
      }
  };

  const executeShare = async () => {
      const fileName = buildExportFileName();

      if (Capacitor.isNativePlatform()) {
          try {
              const result = await Filesystem.writeFile({
                  path: fileName,
                  data: exportData,
                  directory: Directory.Cache,
                  encoding: Encoding.UTF8
              });
              await Share.share({
                  files: [result.uri],
                  title: 'MonoTracker Backup',
                  dialogTitle: 'MonoTracker Backup'
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

      const file = new File([exportData], fileName, { type: 'text/csv' });
      try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: 'MonoTracker Backup'
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
      } catch (e) {
          await openAlert(TEXTS.copyFailed[language]);
      }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const newItems = importCSV(content);
      setItems(prev => [...prev, ...newItems]); 
    };
    reader.readAsText(file);
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
        const pDate = new Date(i.purchaseDate).getTime();
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
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + item.price);
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
  }, [ownedItems, categories, normalizeChannelValue, language]);

  const monthlySpendMax = useMemo(
    () => stats.monthlySpend.reduce((acc, curr) => Math.max(acc, curr.value), 1),
    [stats.monthlySpend]
  );

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
        <h1 className="text-3xl font-bold tracking-tight mb-1">MonoTracker</h1>
        {activeTab === 'profile' ? (
             <p className="opacity-60 text-sm">{TEXTS.tabMine[language]}</p>
        ) : activeTab === 'stats' ? (
             <p className="opacity-60 text-sm">{TEXTS.tabStats[language]}</p>
        ) : (
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-light">{currencySymbol}{activeTab === 'owned' ? totalValue.toLocaleString() : '0'}</span>
                <span className="text-sm opacity-60 uppercase tracking-widest font-semibold">{TEXTS.totalValue[language]}</span>
            </div>
        )}
      </div>

      {/* STATISTICS TAB */}
      {activeTab === 'stats' && (
        <div className="p-6 space-y-6 pb-32">
             {/* 1. Overview */}
             <div className="space-y-4">
                  <h2 className="text-lg font-bold opacity-80 flex items-center gap-2">
                      <ICONS.PieChart size={20}/> {TEXTS.statsOverview[language]}
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm transition-colors">
                          <p className="text-xs opacity-50 uppercase font-bold mb-1">{TEXTS.totalValue[language]}</p>
                          <p className={`text-2xl font-light ${themeColors.secondary}`}>{currencySymbol}{stats.totalVal.toLocaleString()}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm transition-colors">
                          <p className="text-xs opacity-50 uppercase font-bold mb-1">{TEXTS.itemCount[language]}</p>
                          <p className="text-2xl font-light text-gray-800 dark:text-gray-100">{stats.totalCount}</p>
                      </div>
                  </div>
             </div>

             {/* 1.5 Monthly Spend Trend */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                     <ICONS.BarChart2 size={16}/> {TEXTS.statsMonthlyTrend[language]}
                 </h3>
                 <div className="flex items-end justify-between h-32 gap-2">
                     {stats.monthlySpend.map(({ month, value }) => {
                         const height = (value / monthlySpendMax) * 100;
                         return (
                             <div key={month} className="flex flex-col items-center flex-1 group">
                                 <div className="relative w-full bg-gray-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end justify-center h-full">
                                     <div 
                                        className={`w-full transition-all duration-500 ${themeColors.primary}`} 
                                        style={{ height: `${height}%`, opacity: value > 0 ? 0.8 : 0.1 }} 
                                     />
                                     <span className="absolute bottom-1 text-[10px] font-bold text-gray-500 dark:text-gray-300">{currencySymbol}{value.toFixed(0)}</span>
                                 </div>
                                 <span className="text-[10px] mt-2 text-gray-400 font-medium whitespace-nowrap">{month}</span>
                             </div>
                         );
                     })}
                     {stats.monthlySpend.length === 0 && <p className="text-xs opacity-40">{TEXTS.none[language]}</p>}
                 </div>
             </div>

             {/* 2. Status Distribution */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                     <ICONS.Layers size={16}/> {TEXTS.statsStatusDist[language]}
                 </h3>
                 <div className="space-y-3">
                     {stats.statusStats.map(stat => (
                         <div key={stat.status}>
                             <div className="flex justify-between text-sm mb-1">
                                 <span className="capitalize font-medium">{getStatusLabel(stat.status)}</span>
                                 <span className="opacity-60">{stat.count} ({stat.percent.toFixed(1)}%)</span>
                             </div>
                             <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className={`h-full rounded-full ${themeColors.primary}`} style={{width: `${stat.percent}%`, opacity: 0.7}}></div>
                             </div>
                         </div>
                     ))}
                     {stats.statusStats.length === 0 && <p className="text-center text-xs opacity-40">No data</p>}
                 </div>
             </div>

             {/* 3. Duration Distribution */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                     <ICONS.Clock size={16}/> {TEXTS.statsDuration[language]}
                 </h3>
                 <div className="flex items-end justify-between h-32 gap-2">
                     {Object.entries(stats.durationBuckets).map(([label, count]) => {
                         const numericCount = count as number;
                         const max = Math.max(...(Object.values(stats.durationBuckets) as number[])) || 1;
                         const height = (numericCount / max) * 100;
                         return (
                             <div key={label} className="flex flex-col items-center flex-1 group">
                                 <div className="relative w-full bg-gray-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end justify-center h-full">
                                     <div 
                                        className={`w-full transition-all duration-500 ${themeColors.primary}`} 
                                        style={{ height: `${height}%`, opacity: numericCount > 0 ? 0.8 : 0.1 }} 
                                     />
                                     <span className="absolute bottom-1 text-[10px] font-bold text-gray-500 dark:text-gray-300">{numericCount}</span>
                                 </div>
                                 <span className="text-[10px] mt-2 text-gray-400 font-medium whitespace-nowrap">{label}</span>
                             </div>
                         );
                     })}
                 </div>
             </div>

             {/* 4. Category Spend Trend (Top N) */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-sm font-bold opacity-70 flex items-center gap-2">
                       <ICONS.BarChart2 size={16}/> {TEXTS.statsCategoryTrend[language]}
                   </h3>
                   <div className="flex gap-2">
                     {[3, 5, 10].map(count => (
                       <button
                         key={count}
                         onClick={() => setTopN(count)}
                         className={`px-2 py-1 text-[10px] font-bold rounded-full transition-all ${
                           topN === count
                             ? `${themeColors.primary} text-white`
                             : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
                         }`}
                       >
                         TOP {count}
                       </button>
                     ))}
                   </div>
                 </div>
                 <div className="space-y-4">
                     {stats.catStatsByValue.slice(0, topN).map((stat) => {
                         const conf = CATEGORY_CONFIG[stat.cat] || CATEGORY_CONFIG['other'];
                         const Icon = conf.icon;
                         return (
                             <div key={stat.cat}>
                                 <div className="flex items-center justify-between mb-1">
                                     <div className="flex items-center gap-2">
                                         <div className={`p-1 rounded-md ${conf.bg}`}>
                                             <Icon size={12} className={conf.color} />
                                         </div>
                                         <span className="text-sm font-medium">{getCategoryLabel(stat.cat)}</span>
                                     </div>
                                     <span className="text-sm font-bold">?{stat.value.toLocaleString()}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                     <div 
                                       className={`h-full rounded-full ${conf.color.replace(/text-(\w+)-(\d+)/, 'bg-$1-$2')}`} 
                                       style={{ width: `${stat.percentVal}%` }}
                                     />
                                 </div>
                             </div>
                         );
                     })}
                     {stats.catStatsByValue.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.none[language]}</p>}
                 </div>
             </div>

             {/* 4.5 Channel Spend Trend */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                     <ICONS.BarChart2 size={16}/> {TEXTS.statsChannelTrend[language]}
                 </h3>
                 <div className="space-y-4">
                     {stats.channelStats.map((stat) => (
                       <div key={stat.channel}>
                         <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{getChannelLabel(stat.channel)}</span>
                           <span className="text-sm font-bold">?{stat.value.toLocaleString()}</span>
                         </div>
                         <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                           <div
                             className={`h-full rounded-full ${themeColors.primary}`}
                             style={{ width: `${stat.percentVal}%`, opacity: 0.7 }}
                           />
                         </div>
                       </div>
                     ))}
                     {stats.channelStats.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.none[language]}</p>}
                 </div>
             </div>

             {/* 5. Category Count Distribution */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                     <ICONS.BarChart2 size={16}/> {TEXTS.statsCountDist[language]}
                 </h3>
                 <div className="space-y-4">
                     {stats.catStatsByCount.slice(0, 6).map((stat) => { // Top 6
                         const conf = CATEGORY_CONFIG[stat.cat] || CATEGORY_CONFIG['other'];
                         const Icon = conf.icon;
                         return (
                             <div key={stat.cat}>
                                 <div className="flex items-center justify-between mb-1">
                                     <div className="flex items-center gap-2">
                                         <div className={`p-1 rounded-md ${conf.bg}`}>
                                             <Icon size={12} className={conf.color} />
                                         </div>
                                         <span className="text-sm font-medium">{getCategoryLabel(stat.cat)}</span>
                                     </div>
                                     <span className="text-sm font-bold">{stat.count}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                     <div 
                                       className={`h-full rounded-full ${conf.color.replace(/text-(\w+)-(\d+)/, 'bg-$1-$2')}`} 
                                       style={{ width: `${stat.percentCount}%` }}
                                     />
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>

             {/* 6. Status Timeline */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                     <ICONS.TrendingUp size={16}/> {TEXTS.statsTimeline[language]}
                 </h3>
                 <div className="space-y-0 relative border-l-2 border-gray-100 dark:border-slate-800 ml-2">
                     {stats.timelineData.slice(0, 10).map((item, idx) => ( // Show last 10 activities
                         <div key={item.id} className="mb-6 ml-4 relative">
                             <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${themeColors.primary}`}></div>
                             <div className="flex justify-between items-start">
                                 <div>
                                     <p className="text-xs text-gray-400 font-mono mb-0.5">{item.purchaseDate}</p>
                                     <p className="text-sm font-bold">{item.name}</p>
                                 </div>
                                 <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-medium capitalize">
                                     {getStatusLabel(item.status)}
                                 </span>
                             </div>
                         </div>
                     ))}
                     {stats.timelineData.length === 0 && <p className="ml-4 text-xs opacity-40">No activity</p>}
                 </div>
             </div>
        </div>
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
                <input type="file" accept=".csv" hidden onChange={handleImport} />
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
