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
  imageMap?: Record<string, string>;
  onRequestImage?: (item: Item) => Promise<string | undefined>;
  onPreviewImage?: (item: Item) => void | Promise<void>;
}

type TimelineEntry = {
  item: Item;
  costPerDay: number;
  costPerUse: number;
  showPerDay: boolean;
  showPerUse: boolean;
  catName: string;
  priceHistoryStats: {
    latest: { date: string; price: number };
    min: number;
    max: number;
    count: number;
  } | null;
};

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

const TimelineImage: React.FC<{
  item: Item;
  src?: string;
  onRequestImage?: (item: Item) => Promise<string | undefined>;
  onPreviewImage?: (item: Item) => void | Promise<void>;
}> = ({ item, src, onRequestImage, onPreviewImage }) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (src || !item.hasImage || !hostRef.current || !onRequestImage) return;
    const node = hostRef.current;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      void onRequestImage(item).catch(() => {
        // Ignore image read errors and keep placeholder.
      });
    }, { rootMargin: '120px 0px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [item, onRequestImage, src]);

  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
  const CatIcon = catConfig.icon;

  return (
    <div
      ref={hostRef}
      className={`w-20 h-20 flex-shrink-0 bg-gray-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 relative ${src && onPreviewImage ? 'cursor-zoom-in' : 'cursor-default'}`}
      onClick={() => {
        if (src && onPreviewImage) void onPreviewImage(item);
      }}
    >
      {src ? (
        <img src={src} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
          <ICONS.ImageIcon size={24} />
        </div>
      )}
      <div className="absolute top-1 left-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
        <CatIcon size={12} className={catConfig.color} />
      </div>
    </div>
  );
};

const Timeline: React.FC<TimelineProps> = ({
  items,
  theme,
  language,
  onEdit,
  onAddUsage,
  onPreviewImage,
  imageMap = {},
  onRequestImage
}) => {
  const themeColors = THEMES[theme];
  const currencySymbol = '\u00a5';
  const [visibleCount, setVisibleCount] = React.useState(40);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  const getPriceHistoryStats = React.useCallback((history?: { date: string; price: number }[]) => {
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
  }, []);

  React.useEffect(() => {
    setVisibleCount(40);
  }, [items]);

  const sortedItems = React.useMemo(
    () => [...items].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()),
    [items]
  );

  const groupedTimeline = React.useMemo(() => {
    const groups = new Map<string, { key: string; title: string; items: TimelineEntry[] }>();

    sortedItems.slice(0, visibleCount).forEach(item => {
      const date = new Date(item.purchaseDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const title = getGroupTitle(`${key}-01`, language);
      if (!groups.has(key)) {
        groups.set(key, { key, title, items: [] });
      }

      const days = getDaysOwned(item.purchaseDate);
      const costPerDay = item.price / days;
      const costPerUse = item.usageCount ? item.price / item.usageCount : item.price;
      const valueDisplay = item.valueDisplay || 'both';
      const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
      const catName = CATEGORY_CONFIG[item.category] ? TEXTS[catConfig.labelKey][language] : item.category;

      groups.get(key)!.items.push({
        item,
        costPerDay,
        costPerUse,
        showPerDay: valueDisplay !== 'use',
        showPerUse: valueDisplay !== 'day',
        catName,
        priceHistoryStats: getPriceHistoryStats(item.priceHistory)
      });
    });

    return {
      keys: Array.from(groups.keys()).sort((a, b) => b.localeCompare(a)),
      groups
    };
  }, [getPriceHistoryStats, language, sortedItems, visibleCount]);

  const hasMore = sortedItems.length > visibleCount;

  React.useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;
    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount(prev => prev + 40);
      }
    }, { rootMargin: '320px 0px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  const getStatusLabel = (status: string) => {
    if (status === 'new') return TEXTS.statusNew[language];
    if (status === 'used') return TEXTS.statusUsed[language];
    if (status === 'broken') return TEXTS.statusBroken[language];
    if (status === 'sold') return TEXTS.statusSold[language];
    if (status === 'emptied') return TEXTS.statusEmptied[language];
    return status;
  };

  const getChannelLabel = (channel: string) => {
    const key = `chan${channel}`;
    return TEXTS[key] ? TEXTS[key][language] : channel;
  };

  if (groupedTimeline.keys.length === 0) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center opacity-40 space-y-4">
        <ICONS.Tag size={48} />
        <p className="text-lg font-medium">{TEXTS.noItemsYet[language]}</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-32 px-4 space-y-6 pt-2">
      {groupedTimeline.keys.map(key => {
        const group = groupedTimeline.groups.get(key);
        if (!group) return null;

        return (
          <div key={key}>
            <div className="flex items-center gap-3 mb-3 ml-2">
              <div className={`w-2 h-2 rounded-full ${themeColors.primary}`}></div>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {group.title}
              </h2>
            </div>

            <div className="space-y-3">
              {group.items.map(entry => {
                const { item, costPerDay, costPerUse, showPerDay, showPerUse, catName, priceHistoryStats } = entry;

                return (
                  <div key={item.id} className="relative bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden group transition-colors">
                    <div className="flex gap-4 mb-3">
                      <TimelineImage
                        item={item}
                        src={item.image || imageMap[item.id]}
                        onRequestImage={onRequestImage}
                        onPreviewImage={onPreviewImage}
                      />

                      <div className="flex-1 min-w-0 pr-8">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base truncate mb-1">{item.name}</h3>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-mono font-bold text-lg ${themeColors.secondary}`}>
                            {currencySymbol}{item.price.toLocaleString()}
                          </span>
                          {(item.quantity || 1) > 1 && (
                            <>
                              <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                x{item.quantity || 1}
                              </span>
                              <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                                {TEXTS.avgPrice[language]} {currencySymbol}{(item.avgPrice ?? (item.price / (item.quantity || 1))).toFixed(2)}
                              </span>
                            </>
                          )}
                          {item.msrp > item.price && (
                            <span className="text-xs text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                              {currencySymbol}{item.msrp.toLocaleString()}
                            </span>
                          )}
                          {item.storeName && (
                            <span className="ml-2 text-[10px] text-gray-500 bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                              {item.storeName}
                            </span>
                          )}
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
                          {!CATEGORY_CONFIG[item.category] && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                              {catName}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                        className="absolute top-4 right-4 p-2 text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        <ICONS.Edit3 size={18} />
                      </button>
                    </div>

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
                              <ICONS.Activity size={12} className="text-gray-400" />
                              <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{item.usageCount || 0}</span>
                            </div>
                            <button
                              onClick={e => {
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
        );
      })}
      {hasMore && <div ref={loadMoreRef} className="h-8" />}
    </div>
  );
};

export default React.memo(Timeline);
