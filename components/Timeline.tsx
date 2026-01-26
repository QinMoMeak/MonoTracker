
import React from 'react';
import { Item, Language, ThemeColor } from '../types';
import { THEMES, ICONS, TEXTS, CATEGORY_CONFIG } from '../constants';

interface TimelineProps {
  items: Item[];
  theme: ThemeColor;
  language: Language;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onAddUsage: (item: Item) => void;
  onPreviewImage?: (src: string, name?: string) => void;
}

const getDaysOwned = (dateStr: string) => {
  const start = new Date(dateStr).getTime();
  const now = new Date().getTime();
  const diff = now - start;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const getGroupTitle = (dateStr: string, language: Language) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    if (language === 'en') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
    return `${year}年${month}月`;
};

const Timeline: React.FC<TimelineProps> = ({ items, theme, language, onEdit, onAddUsage, onPreviewImage }) => {
  const themeColors = THEMES[theme];
  const currencySymbol = '\u00a5';

  const getPriceHistoryStats = (history?: { date: string; price: number }[]) => {
    if (!history || history.length === 0) return null;
    let latest = history[0];
    let min = history[0].price;
    let max = history[0].price;
    history.forEach(point => {
      if (point.date > latest.date) latest = point;
      if (point.price < min) min = point.price;
      if (point.price > max) max = point.price;
    });
    return {
      latest,
      min,
      max,
      count: history.length
    };
  };

  // Sort items by date descending
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }, [items]);

  // Group items by Month/Year
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, Item[]> = {};
    sortedItems.forEach(item => {
        const date = new Date(item.purchaseDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
  }, [sortedItems]);

  const groupKeys = Object.keys(groupedItems).sort((a, b) => b.localeCompare(a)); // Newest months first

  if (sortedItems.length === 0) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center opacity-40 space-y-4">
        <ICONS.Tag size={48} />
        <p className="text-lg font-medium">{TEXTS.noItemsYet[language]}</p>
      </div>
    );
  }

  // Helper to get status label (localized or custom)
  const getStatusLabel = (s: string) => {
     if (s === 'new') return TEXTS.statusNew[language];
     if (s === 'used') return TEXTS.statusUsed[language];
     if (s === 'broken') return TEXTS.statusBroken[language];
     if (s === 'sold') return TEXTS.statusSold[language];
     if (s === 'emptied') return TEXTS.statusEmptied[language];
     return s;
  };

  const getChannelLabel = (channel: string) => {
    const key = `chan${channel}`;
    return TEXTS[key] ? TEXTS[key][language] : channel;
  };


  return (
    <div className="w-full pb-32 px-4 space-y-6 pt-2">
      {groupKeys.map(key => (
        <div key={key}>
            {/* Timeline Header */}
            <div className="flex items-center gap-3 mb-3 ml-2">
                <div className={`w-2 h-2 rounded-full ${themeColors.primary}`}></div>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {getGroupTitle(`${key}-01`, language)}
                </h2>
            </div>

            <div className="space-y-3">
                {groupedItems[key].map(item => {
                    const days = getDaysOwned(item.purchaseDate);
                    const costPerDay = item.price / days;
                    const costPerUse = item.usageCount ? item.price / item.usageCount : item.price;
                    const valueDisplay = item.valueDisplay || 'both';
                    const showPerDay = valueDisplay !== 'use';
                    const showPerUse = valueDisplay !== 'day';
                    
                    // Handle custom categories: fallback to 'other' config if key not found
                    const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG['other'];
                    const CatIcon = catConfig.icon;
                    // Display name: if it's a known key, use translation, else use raw string
                    const catName = CATEGORY_CONFIG[item.category] 
                        ? TEXTS[catConfig.labelKey][language] 
                        : item.category;
                    const priceHistoryStats = getPriceHistoryStats(item.priceHistory);

                    return (
                        <div key={item.id} className="relative bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden group transition-colors">
                            <div className="flex gap-4 mb-3">
                                {/* Image Section */}
                                <div
                                    className={`w-20 h-20 flex-shrink-0 bg-gray-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 relative ${item.image && onPreviewImage ? 'cursor-zoom-in' : 'cursor-default'}`}
                                    onClick={() => {
                                        if (item.image && onPreviewImage) onPreviewImage(item.image, item.name);
                                    }}
                                >
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                                            <ICONS.ImageIcon size={24} />
                                        </div>
                                    )}
                                    {/* Category Badge */}
                                    <div className="absolute top-1 left-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
                                        <CatIcon size={12} className={catConfig.color} />
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div className="flex-1 min-w-0 pr-8">
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base truncate mb-1">{item.name}</h3>
                                    
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`font-mono font-bold text-lg ${themeColors.secondary}`}>
                                            {currencySymbol}{item.price.toLocaleString()}
                                        </span>
                                        {item.msrp > item.price && (
                                            <span className="text-xs text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                                                {currencySymbol}{item.msrp.toLocaleString()}
                                            </span>
                                        )}
                                        {/* Channel Badge */}
                                        {item.channel && (
                                            <span className="ml-2 text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                                {getChannelLabel(item.channel)}
                                            </span>
                                        )}
                                    </div>

                                    {item.type === 'wishlist' && priceHistoryStats && (
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
                                            <span className="uppercase text-[10px] opacity-50">{TEXTS.priceHistoryShort[language]}</span>
                                            <span>{TEXTS.priceHistoryLatest[language]} {currencySymbol}{priceHistoryStats.latest.price.toFixed(0)}</span>
                                            <span>{TEXTS.priceHistoryMin[language]} {currencySymbol}{priceHistoryStats.min.toFixed(0)}</span>
                                            <span>{TEXTS.priceHistoryMax[language]} {currencySymbol}{priceHistoryStats.max.toFixed(0)}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <ICONS.Calendar size={10} />
                                            {item.purchaseDate}
                                        </span>
                                        {item.status !== 'new' && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700 px-2 py-0.5 rounded-md capitalize">
                                                {getStatusLabel(item.status)}
                                            </span>
                                        )}
                                        {/* Show Custom Category Name if not standard */}
                                        {!CATEGORY_CONFIG[item.category] && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                                                {catName}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Edit Button */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(item);
                                    }} 
                                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                >
                                    <ICONS.Edit3 size={18} />
                                </button>
                            </div>

                            {/* Stats Footer (Only for owned items) */}
                            {item.type === 'owned' && (
                                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex gap-4">
                                        {showPerDay && (
                                            <div className="flex flex-col">
                                                <span className="opacity-50 text-[10px] uppercase">{TEXTS.valPerDay[language]}</span>
                                                <span className="font-mono font-semibold">{currencySymbol}{costPerDay.toFixed(1)}</span>
                                            </div>
                                        )}
                                        {showPerUse && (
                                            <div className="flex flex-col">
                                                <span className="opacity-50 text-[10px] uppercase">{TEXTS.valPerUse[language]}</span>
                                                <span className="font-mono font-semibold">{currencySymbol}{costPerUse.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {showPerUse && (
                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 rounded-lg p-1 pl-3 pr-1">
                                            <div className="flex items-center gap-1">
                                                <ICONS.Activity size={12} className="text-gray-400"/>
                                                <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{item.usageCount || 0}</span>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAddUsage(item);
                                                }}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold text-white shadow-sm transition-transform active:scale-95 ${themeColors.primary}`}
                                            >
                                                {TEXTS.addUsage[language]}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(Timeline);
