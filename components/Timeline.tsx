import React from 'react';
import { Item, Language, ThemeColor } from '../types';
import { THEMES, ICONS, TEXTS, CATEGORY_CONFIG } from '../constants';
import { formatDate, formatMonth } from '../utils/date';
import { formatCurrency } from '../utils/format';
import { TimelineEntryBase, useTimelineGroups } from '../hooks/useTimelineGroups';

interface TimelineProps {
  items: Item[];
  theme: ThemeColor;
  language: Language;
  isActive: boolean;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onAddUsage: (item: Item) => void;
  onRequestImage?: (item: Item) => Promise<string | undefined>;
  onPreviewImage?: (item: Item) => void | Promise<void>;
}

const getGroupTitle = (monthKey: string) => formatMonth(`${monthKey}-01`);

const getStatusLabel = (status: string, language: Language) => {
  if (status === 'new') return TEXTS.statusNew[language];
  if (status === 'used') return TEXTS.statusUsed[language];
  if (status === 'broken') return TEXTS.statusBroken[language];
  if (status === 'sold') return TEXTS.statusSold[language];
  if (status === 'emptied') return TEXTS.statusEmptied[language];
  return status;
};

const getChannelLabel = (channel: string, language: Language) => {
  const key = `chan${channel}`;
  return TEXTS[key] ? TEXTS[key][language] : channel;
};

const TimelineImage = React.memo(({
  item,
  src,
  isActive,
  onRequestImage,
  onPreviewImage
}: {
  item: Item;
  src?: string;
  isActive: boolean;
  onRequestImage?: (item: Item) => Promise<string | undefined>;
  onPreviewImage?: (item: Item) => void | Promise<void>;
}) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = React.useState(src);

  React.useEffect(() => {
    setResolvedSrc(src);
  }, [src]);

  React.useEffect(() => {
    if (!isActive || resolvedSrc || !item.hasImage || !hostRef.current || !onRequestImage) return undefined;
    const node = hostRef.current;
    let cancelled = false;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      void onRequestImage(item)
        .then(image => {
          if (!cancelled && image) {
            setResolvedSrc(image);
          }
        })
        .catch(() => {
          // Ignore image read errors and keep placeholder.
        });
    }, { rootMargin: '160px 0px' });

    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [isActive, item, onRequestImage, resolvedSrc]);

  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
  const CatIcon = catConfig.icon;

  return (
    <div
      ref={hostRef}
      className={`w-20 h-20 flex-shrink-0 bg-gray-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700 relative ${resolvedSrc && onPreviewImage ? 'cursor-zoom-in' : 'cursor-default'}`}
      onClick={() => {
        if (resolvedSrc && onPreviewImage) void onPreviewImage(item);
      }}
    >
      {resolvedSrc ? (
        <img src={resolvedSrc} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
});

const TimelineItemCard = React.memo(({
  entry,
  theme,
  language,
  isActive,
  onEdit,
  onAddUsage,
  onRequestImage,
  onPreviewImage
}: {
  entry: TimelineEntryBase;
  theme: ThemeColor;
  language: Language;
  isActive: boolean;
  onEdit: (item: Item) => void;
  onAddUsage: (item: Item) => void;
  onRequestImage?: (item: Item) => Promise<string | undefined>;
  onPreviewImage?: (item: Item) => void | Promise<void>;
}) => {
  const themeColors = THEMES[theme];
  const { item, costPerDay, costPerUse, daysUsed, showPerDay, showPerUse, priceHistoryStats } = entry;
  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
  const catName = CATEGORY_CONFIG[item.category] ? TEXTS[catConfig.labelKey][language] : item.category;
  const showDaysUsed = (item.valueDisplay || 'both') === 'day';

  return (
    <div
      className="relative bg-white dark:bg-slate-900 rounded-[1.5rem] p-4 shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden group transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '220px' } as React.CSSProperties}
    >
      <div className="flex gap-4 mb-3">
        <TimelineImage
          item={item}
          src={item.imageThumb}
          isActive={isActive}
          onRequestImage={onRequestImage}
          onPreviewImage={onPreviewImage}
        />

        <div className="flex-1 min-w-0 pr-8">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base truncate mb-1">{item.name}</h3>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono font-bold text-lg ${themeColors.secondary}`}>
              {formatCurrency(item.price, item.currency || 'CNY', language)}
            </span>
            {(item.quantity || 1) > 1 && (
              <>
                <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                  x{item.quantity || 1}
                </span>
                <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                  {TEXTS.avgPrice[language]} {formatCurrency(item.avgPrice ?? (item.price / (item.quantity || 1)), item.currency || 'CNY', language)}
                </span>
              </>
            )}
            {item.msrp > item.price && (
              <span className="text-xs text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                {formatCurrency(item.msrp, item.currency || 'CNY', language)}
              </span>
            )}
            {item.storeName && (
              <span className="ml-2 text-[10px] text-gray-500 bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                {item.storeName}
              </span>
            )}
            {item.channel && (
              <span className="ml-2 text-[10px] text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                {getChannelLabel(item.channel, language)}
              </span>
            )}
          </div>

          {item.type === 'wishlist' && priceHistoryStats && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-2">
              <span className="uppercase text-[10px] opacity-50">{TEXTS.priceHistoryShort[language]}</span>
              <span>{TEXTS.priceHistoryLatest[language]} {formatCurrency(priceHistoryStats.latest.price, item.currency || 'CNY', language, { maximumFractionDigits: 0 })}</span>
              <span>{TEXTS.priceHistoryMin[language]} {formatCurrency(priceHistoryStats.min, item.currency || 'CNY', language, { maximumFractionDigits: 0 })}</span>
              <span>{TEXTS.priceHistoryMax[language]} {formatCurrency(priceHistoryStats.max, item.currency || 'CNY', language, { maximumFractionDigits: 0 })}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-md flex items-center gap-1">
              <ICONS.Calendar size={10} />
              {formatDate(item.purchaseDate)}
            </span>
            {item.status !== 'new' && (
              <span className="text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-slate-700 px-2 py-0.5 rounded-md capitalize">
                {getStatusLabel(item.status, language)}
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
                <span className="font-mono font-semibold">{formatCurrency(costPerDay, item.currency || 'CNY', language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              </div>
            )}
            {showPerUse && (
              <div className="flex flex-col">
                <span className="opacity-50 text-[10px] uppercase">{TEXTS.valPerUse[language]}</span>
                <span className="font-mono font-semibold">{formatCurrency(costPerUse, item.currency || 'CNY', language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              </div>
            )}
          </div>

          {showDaysUsed && (
            <div className="flex flex-col text-right">
              <span className="opacity-50 text-[10px] uppercase">{TEXTS.daysUsed[language]}</span>
              <span className="font-mono font-semibold">
                {daysUsed}
                {language === 'en' ? ` ${TEXTS.daysUsedUnit[language]}` : TEXTS.daysUsedUnit[language]}
              </span>
            </div>
          )}

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
});

const Timeline: React.FC<TimelineProps> = ({
  items,
  theme,
  language,
  isActive,
  onEdit,
  onAddUsage,
  onPreviewImage,
  onRequestImage
}) => {
  const themeColors = THEMES[theme];
  const [visibleCount, setVisibleCount] = React.useState(40);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const useCompactWindowing = items.length > 200;
  const batchSize = useCompactWindowing ? 24 : 40;

  React.useEffect(() => {
    setVisibleCount(batchSize);
  }, [batchSize, items]);

  const { sortedItems, groupedTimeline, hasMore } = useTimelineGroups(items, visibleCount);

  React.useEffect(() => {
    if (!isActive || !hasMore || !loadMoreRef.current) return undefined;
    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount(prev => prev + batchSize);
      }
    }, { rootMargin: useCompactWindowing ? '480px 0px' : '320px 0px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [batchSize, hasMore, isActive, useCompactWindowing]);

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
            <div className="flex items-center gap-3 mb-3 ml-2 sticky top-0 z-10 backdrop-blur-sm">
              <div className={`w-2 h-2 rounded-full ${themeColors.primary}`}></div>
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {getGroupTitle(key)}
              </h2>
            </div>

            <div className="space-y-3">
              {group.map(entry => (
                <TimelineItemCard
                  key={entry.item.id}
                  entry={entry}
                  theme={theme}
                  language={language}
                  isActive={isActive}
                  onEdit={onEdit}
                  onAddUsage={onAddUsage}
                  onRequestImage={onRequestImage}
                  onPreviewImage={onPreviewImage}
                />
              ))}
            </div>
          </div>
        );
      })}
      {hasMore && <div ref={loadMoreRef} className="h-8" />}
    </div>
  );
};

export default React.memo(Timeline);
