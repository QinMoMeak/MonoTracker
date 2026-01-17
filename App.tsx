import React, { useState, useEffect, useMemo } from 'react';
import { registerPlugin } from '@capacitor/core';
import { Item, Language, ThemeColor, Tab, CategoryType, AppearanceMode } from './types';
import { THEMES, TEXTS, ICONS, INITIAL_ITEMS, CATEGORY_CONFIG } from './constants';
import { loadState, saveState, importCSV, exportCSV } from './services/storageService';
import Timeline from './components/Timeline';
import AddItemModal from './components/AddItemModal';

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
  const [showAiFab, setShowAiFab] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  
  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState('');
  
  // Generic filter state: 'all' or specific value (status for owned, category for wishlist)
  const [activeFilter, setActiveFilter] = useState<string>('all');
  
  // Custom Data State
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customChannels, setCustomChannels] = useState<string[]>([]);

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
    if (loaded.showAiFab !== undefined) setShowAiFab(loaded.showAiFab);
    if (loaded.customCategories) setCustomCategories(loaded.customCategories);
    if (loaded.customChannels) setCustomChannels(loaded.customChannels);
    
    // Mark as loaded to enable saving
    setIsLoaded(true);
  }, []);

  // --- Persistence ---
  useEffect(() => {
    // Prevent saving if we haven't loaded yet to avoid overwriting with initial empty state
    if (!isLoaded) return;

    saveState({ items, language, theme, appearance, showAiFab, customCategories, customChannels });
  }, [items, language, theme, appearance, showAiFab, customCategories, customChannels, isLoaded]);

  // --- History Handling (Back Gesture) ---
  useEffect(() => {
    const handlePopState = () => {
      // If modal is open and user presses back, close it
      if (isAddModalOpen) {
        setIsAddModalOpen(false);
        setEditingItem(null);
      }
      if (showExportModal) {
          setShowExportModal(false);
      }
    };

    if (isAddModalOpen || showExportModal) {
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isAddModalOpen, showExportModal]);

  // Reset filter on tab change
  useEffect(() => {
    setActiveFilter('all');
  }, [activeTab]);

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
            channel: itemData.channel
        };
        setItems(prev => [newItem, ...prev]);
    }
    setEditingItem(null);
    // Go back in history to close modal (triggers popstate listener)
    window.history.back();
  };

  const handleEditItem = (item: Item) => {
      setEditingItem(item);
      setInitialAddMode('manual');
      setIsAddModalOpen(true);
      // Push state to allow back button to close modal
      window.history.pushState(null, '', '');
  };

  const handleOpenAdd = (mode: 'ai' | 'manual') => {
      setEditingItem(null);
      setInitialAddMode(mode);
      setIsAddModalOpen(true);
      // Push state to allow back button to close modal
      window.history.pushState(null, '', '');
  };

  const handleCloseModal = () => {
      // Go back in history (triggers popstate listener to close modal)
      window.history.back();
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm(TEXTS.deleteConfirm[language])) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleAddUsage = (item: Item) => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, usageCount: (i.usageCount || 0) + 1 } : i));
  };

  // Custom Data Handlers
  const handleAddCustomCategory = (cat: string) => {
    if (cat && !customCategories.includes(cat)) {
        setCustomCategories(prev => [...prev, cat]);
    }
  };

  const handleAddCustomChannel = (chan: string) => {
    if (chan && !customChannels.includes(chan)) {
        setCustomChannels(prev => [...prev, chan]);
    }
  };

  const handleDeleteCustomCategory = (cat: string) => {
      if (window.confirm(TEXTS.confirmDeleteTag[language])) {
          setCustomCategories(prev => prev.filter(c => c !== cat));
      }
  };

  const handleDeleteCustomChannel = (chan: string) => {
      if (window.confirm(TEXTS.confirmDeleteTag[language])) {
          setCustomChannels(prev => prev.filter(c => c !== chan));
      }
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
      const fileName = `monotracker_backup_${new Date().toISOString().split('T')[0]}.csv`;

      // Strategy -1: Capacitor Native Plugin (Highest Priority)
      try {
          // Attempt to use the registered Capacitor plugin
          const result = await ExportPlugin.exportData({
              content: exportData,
              fileName: fileName,
              mimeType: 'text/csv'
          });
          console.log('Export success via Capacitor:', result.uri);
          alert(TEXTS.exportSuccess[language]);
          return; // Stop here if native export works
      } catch (error: any) {
          console.warn('Capacitor export failed or not available:', error);
          // If error is "User cancelled", stop. Otherwise, fall through to other methods.
          if (error.message === 'User cancelled export') return;
      }
      
      // Strategy 0: Legacy Android Bridge (JSBridge - direct window injection)
      if (window.Android && window.Android.saveCSV) {
          try {
              window.Android.saveCSV(exportData, fileName);
              return; 
          } catch (e) {
              console.error("Native bridge failed, falling back to web methods", e);
          }
      }

      // Strategy 1: File System Access API (Native "Save As" intent if supported by browser)
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

      // Strategy 2: Data URI Download (Bypasses Blob Registry restrictions in some WebViews)
      try {
          // Use Base64 to ensure encoding is preserved across strict boundaries
          const base64Content = btoa(unescape(encodeURIComponent(exportData)));
          const dataUri = `data:text/csv;base64,${base64Content}`;
          
          const link = document.createElement('a');
          link.href = dataUri;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          console.error('Data URI download failed:', e);
          alert('Save failed. Please copy the text below.');
      }
  };

  const executeShare = async () => {
      const fileName = `monotracker_backup_${new Date().toISOString().split('T')[0]}.csv`;
      const file = new File([exportData], fileName, { type: 'text/csv' });
      
      try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: 'MonoTracker Backup'
              });
          } else {
              alert('Sharing not supported on this device.');
          }
      } catch (e) {
          console.warn('Share failed:', e);
      }
  };

  const executeCopy = async () => {
      try {
          await navigator.clipboard.writeText(exportData);
          alert(TEXTS.copySuccess[language]);
      } catch (e) {
          alert('Copy failed.');
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
        const standard = ['new', 'used', 'broken', 'sold', 'emptied'];
        standard.forEach(s => options.add(s));
        // Add custom statuses from items
        tabItems.forEach(i => {
            if (i.status) options.add(i.status);
        });
    } else if (activeTab === 'wishlist') {
        // For Wishlist: Filter by Category
        const standard = Object.keys(CATEGORY_CONFIG);
        standard.forEach(c => options.add(c));
        // Add custom categories from items
        tabItems.forEach(i => {
            if (i.category) options.add(i.category);
        });
    }
    
    return Array.from(options);
  }, [tabItems, activeTab]);

  // 3. Filter by selected option
  const finalDisplayItems = useMemo(() => {
      if (activeFilter === 'all') return tabItems;
      if (activeTab === 'owned') return tabItems.filter(i => i.status === activeFilter);
      if (activeTab === 'wishlist') return tabItems.filter(i => i.category === activeFilter);
      return tabItems;
  }, [tabItems, activeFilter, activeTab]);
  
  const totalValue = useMemo(() => items.filter(i => i.type === 'owned').reduce((acc, curr) => acc + curr.price, 0), [items]);

  // --- STATISTICS CALCULATIONS ---
  const stats = useMemo(() => {
    const ownedItems = items.filter(i => i.type === 'owned');
    const totalCount = ownedItems.length;
    const totalVal = ownedItems.reduce((acc, i) => acc + i.price, 0);
    
    // Category Stats (Value & Count)
    // Gather all unique categories (both config and custom)
    const allCats = new Set([...Object.keys(CATEGORY_CONFIG), ...ownedItems.map(i => i.category)]);
    
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

    return { totalCount, totalVal, catStatsByValue, catStatsByCount, statusStats, durationBuckets, timelineData };
  }, [items]);

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
                <span className="text-4xl font-light">¥{activeTab === 'owned' ? totalValue.toLocaleString() : '0'}</span>
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
                          <p className={`text-2xl font-light ${themeColors.secondary}`}>¥{stats.totalVal.toLocaleString()}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm transition-colors">
                          <p className="text-xs opacity-50 uppercase font-bold mb-1">{TEXTS.itemCount[language]}</p>
                          <p className="text-2xl font-light text-gray-800 dark:text-gray-100">{stats.totalCount}</p>
                      </div>
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

             {/* 4. Category Value Distribution */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                 <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                     <ICONS.BarChart2 size={16}/> {TEXTS.statsValDist[language]}
                 </h3>
                 <div className="space-y-4">
                     {stats.catStatsByValue.slice(0, 6).map((stat) => { // Top 6
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
                                     <span className="text-sm font-bold">¥{stat.value.toLocaleString()}</span>
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
          {/* Data Management Section */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm space-y-6 transition-colors">
            <h3 className="flex items-center gap-2 font-bold opacity-70 mb-2">
                <ICONS.Database size={18}/> {TEXTS.manageData[language]}
            </h3>
            
            {/* Custom Categories */}
            <div>
                 <h4 className="text-sm font-semibold mb-3 opacity-60">{TEXTS.manageCat[language]}</h4>
                 <div className="flex flex-wrap gap-2">
                     {customCategories.length === 0 && <p className="text-xs opacity-40">None</p>}
                     {customCategories.map(cat => (
                         <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm">
                             <span>{cat}</span>
                             <button onClick={() => handleDeleteCustomCategory(cat)} className="opacity-50 hover:opacity-100">
                                 <ICONS.X size={14}/>
                             </button>
                         </div>
                     ))}
                 </div>
            </div>

            {/* Custom Channels */}
            <div>
                 <h4 className="text-sm font-semibold mb-3 opacity-60">{TEXTS.manageChan[language]}</h4>
                 <div className="flex flex-wrap gap-2">
                     {customChannels.length === 0 && <p className="text-xs opacity-40">None</p>}
                     {customChannels.map(chan => (
                         <div key={chan} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm">
                             <span>{chan}</span>
                             <button onClick={() => handleDeleteCustomChannel(chan)} className="opacity-50 hover:opacity-100">
                                 <ICONS.X size={14}/>
                             </button>
                         </div>
                     ))}
                 </div>
            </div>
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

            {/* Toggle AI Button */}
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 opacity-70">
                    <ICONS.Sparkles size={18} />
                    <span className="font-bold">{TEXTS.showAiButton[language]}</span>
                </div>
                <button 
                    onClick={() => setShowAiFab(!showAiFab)}
                    className={`w-12 h-7 rounded-full transition-colors duration-300 relative ${showAiFab ? themeColors.primary : 'bg-gray-200 dark:bg-slate-700'}`}
                >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${showAiFab ? 'left-6' : 'left-1'}`} />
                </button>
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

      {/* OWNED / WISHLIST VIEWS */}
      {(activeTab === 'owned' || activeTab === 'wishlist') && (
        <>
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
            {showAiFab && (
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
                    onClick={() => handleOpenAdd(showAiFab ? 'ai' : 'manual')}
                    className={`flex items-center justify-center w-14 h-14 rounded-[1.5rem] shadow-xl text-white transition-transform hover:scale-105 active:scale-95 ${themeColors.primary}`}
                >
                    {showAiFab ? <ICONS.Sparkles size={24} /> : <ICONS.Plus size={28} />}
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

      <AddItemModal 
        isOpen={isAddModalOpen} 
        onClose={handleCloseModal}
        onSave={handleSaveItem}
        language={language}
        theme={theme}
        activeTab={activeTab === 'wishlist' ? 'wishlist' : 'owned'}
        initialItem={editingItem}
        initialMode={initialAddMode}
        customCategories={customCategories}
        customChannels={customChannels}
        onAddCategory={handleAddCustomCategory}
        onAddChannel={handleAddCustomChannel}
      />
    </div>
  );
};

export default App;