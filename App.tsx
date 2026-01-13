import React, { useState, useEffect, useMemo } from 'react';
import { Item, Language, ThemeColor, Tab, CategoryType, AppearanceMode } from './types';
import { THEMES, TEXTS, ICONS, INITIAL_ITEMS, CATEGORY_CONFIG } from './constants';
import { loadState, saveState, importCSV, exportCSV } from './services/storageService';
import Timeline from './components/Timeline';
import AddItemModal from './components/AddItemModal';

const App: React.FC = () => {
  // --- State ---
  const [items, setItems] = useState<Item[]>([]);
  const [language, setLanguage] = useState<Language>('zh-CN');
  const [theme, setTheme] = useState<ThemeColor>('blue');
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [activeTab, setActiveTab] = useState<Tab>('owned');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

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
  }, []);

  // --- Persistence ---
  useEffect(() => {
    saveState({ items, language, theme, appearance });
  }, [items, language, theme, appearance]);

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
            discountRate: itemData.discountRate
        };
        setItems(prev => [newItem, ...prev]);
    }
    setEditingItem(null);
    setIsAddModalOpen(false);
  };

  const handleEditItem = (item: Item) => {
      setEditingItem(item);
      setIsAddModalOpen(true);
  };

  const handleCloseModal = () => {
      setEditingItem(null);
      setIsAddModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm(TEXTS.deleteConfirm[language])) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleAddUsage = (item: Item) => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, usageCount: (i.usageCount || 0) + 1 } : i));
  };

  const handleExport = () => {
    const csv = exportCSV(items);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monotracker_backup_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
  const filteredItems = useMemo(() => items.filter(i => {
      if (activeTab === 'profile') return true;
      return i.type === activeTab;
  }), [items, activeTab]);
  
  const totalValue = useMemo(() => items.filter(i => i.type === 'owned').reduce((acc, curr) => acc + curr.price, 0), [items]);

  // Statistics for Profile
  const stats = useMemo(() => {
    const ownedItems = items.filter(i => i.type === 'owned');
    const totalCount = ownedItems.length;
    const totalVal = ownedItems.reduce((acc, i) => acc + i.price, 0);
    
    const catStats = (Object.keys(CATEGORY_CONFIG) as CategoryType[]).map(cat => {
        const catItems = ownedItems.filter(i => (i.category || 'other') === cat);
        const val = catItems.reduce((acc, i) => acc + i.price, 0);
        return {
            cat,
            count: catItems.length,
            value: val,
            percent: totalVal > 0 ? (val / totalVal) * 100 : 0
        };
    }).sort((a, b) => b.value - a.value);

    return { totalCount, totalVal, catStats };
  }, [items]);

  // --- Render ---
  return (
    <div className={`min-h-screen ${themeColors.surface} ${themeColors.onSurface} font-sans transition-colors duration-500`}>
      {/* Top Bar */}
      <div className="pt-12 px-6 pb-4">
        <h1 className="text-3xl font-bold tracking-tight mb-1">MonoTracker</h1>
        {activeTab === 'profile' ? (
             <p className="opacity-60 text-sm">{TEXTS.tabMine[language]}</p>
        ) : (
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-light">¥{activeTab === 'owned' ? totalValue.toLocaleString() : '0'}</span>
                <span className="text-sm opacity-60 uppercase tracking-widest font-semibold">{TEXTS.totalValue[language]}</span>
            </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'profile' ? (
        <div className="p-6 space-y-6 pb-32">
          
          {/* Statistics Section */}
          <div className="space-y-4">
              <h2 className="text-lg font-bold opacity-80 flex items-center gap-2">
                  <ICONS.PieChart size={20}/> {TEXTS.statsOverview[language]}
              </h2>
              
              {/* Summary Cards */}
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

              {/* Category Chart */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
                  <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                      <ICONS.LayoutGrid size={16}/> {TEXTS.statsCategory[language]}
                  </h3>
                  <div className="space-y-4">
                      {stats.catStats.map((stat) => {
                          const conf = CATEGORY_CONFIG[stat.cat];
                          const Icon = conf.icon;
                          if (stat.count === 0) return null;

                          return (
                              <div key={stat.cat}>
                                  <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                          <div className={`p-1.5 rounded-lg ${conf.bg}`}>
                                              <Icon size={14} className={conf.color} />
                                          </div>
                                          <span className="text-sm font-medium">{TEXTS[conf.labelKey][language]}</span>
                                      </div>
                                      <div className="text-right">
                                          <span className="text-sm font-bold mr-2">¥{stat.value.toLocaleString()}</span>
                                          <span className="text-xs text-gray-400">({stat.count})</span>
                                      </div>
                                  </div>
                                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${conf.color.replace(/text-(\w+)-(\d+)/, 'bg-$1-$2')}`} 
                                        style={{ width: `${stat.percent}%` }}
                                      />
                                  </div>
                              </div>
                          );
                      })}
                      {stats.totalCount === 0 && <p className="text-center text-gray-400 text-sm py-4">No data available</p>}
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
             <button onClick={handleExport} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800">
                <span className="flex items-center gap-3 font-semibold"><ICONS.Download size={20}/> {TEXTS.export[language]}</span>
             </button>
             <label className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer">
                <span className="flex items-center gap-3 font-semibold"><ICONS.Upload size={20}/> {TEXTS.import[language]}</span>
                <input type="file" accept=".csv" hidden onChange={handleImport} />
             </label>
          </div>
        </div>
      ) : (
        <Timeline 
          items={filteredItems} 
          theme={theme} 
          language={language}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          onAddUsage={handleAddUsage}
        />
      )}

      {/* Floating Action Button (FAB) for Add */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className={`
            fixed right-6 bottom-28 z-40 p-5 rounded-[1.5rem] shadow-xl text-white transition-transform hover:scale-105 active:scale-95
            ${themeColors.primary}
        `}
      >
        <ICONS.Plus size={32} />
      </button>

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-6 right-6 h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-2xl rounded-full z-30 flex items-center justify-around px-2 border border-white/50 dark:border-slate-800/50 transition-colors">
        <button 
            onClick={() => setActiveTab('owned')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'owned' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'owned' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.Home size={24} strokeWidth={activeTab === 'owned' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold">{TEXTS.tabOwned[language]}</span>
        </button>
        
        <button 
            onClick={() => setActiveTab('wishlist')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'wishlist' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'wishlist' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.Heart size={24} strokeWidth={activeTab === 'wishlist' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold">{TEXTS.tabWishlist[language]}</span>
        </button>

        <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center w-full h-full rounded-full transition-all duration-300 gap-1 ${activeTab === 'profile' ? `${themeColors.secondary} bg-gray-50/50 dark:bg-slate-800/50` : 'text-gray-400 dark:text-slate-600'}`}
        >
            <div className={`p-1 rounded-full ${activeTab === 'profile' ? themeColors.container : 'bg-transparent'}`}>
                <ICONS.User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold">{TEXTS.tabMine[language]}</span>
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
      />
    </div>
  );
};

export default App;