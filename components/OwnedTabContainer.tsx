import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Timeline from './Timeline';
import { ICONS, TEXTS, THEMES } from '../constants';
import { Item, Language, ThemeColor } from '../types';

type Props = {
  items: Item[];
  theme: ThemeColor;
  language: Language;
  statuses: string[];
  aiEnabled: boolean;
  isActive: boolean;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onAddUsage: (item: Item) => void;
  onRequestImage?: (item: Item) => Promise<string | undefined>;
  onPreviewImage?: (item: Item) => void | Promise<void>;
  onOpenAdd: (mode: 'ai' | 'manual') => void;
};

const OwnedTabContainer: React.FC<Props> = ({
  items,
  theme,
  language,
  statuses,
  aiEnabled,
  isActive,
  onEdit,
  onDelete,
  onAddUsage,
  onRequestImage,
  onPreviewImage,
  onOpenAdd
}) => {
  const themeColors = THEMES[theme];
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredActiveFilter = useDeferredValue(activeFilter);

  const getStatusLabel = useCallback((status: string) => {
    if (status === 'new') return TEXTS.statusNew[language];
    if (status === 'used') return TEXTS.statusUsed[language];
    if (status === 'broken') return TEXTS.statusBroken[language];
    if (status === 'sold') return TEXTS.statusSold[language];
    if (status === 'emptied') return TEXTS.statusEmptied[language];
    return status;
  }, [language]);

  const availableFilters = useMemo(() => {
    const options = new Set<string>();
    statuses.forEach(status => options.add(status));
    items.forEach(item => {
      if (item.status) options.add(item.status);
    });
    return Array.from(options);
  }, [items, statuses]);

  useEffect(() => {
    if (activeFilter === 'all') return;
    if (!availableFilters.includes(activeFilter)) {
      setActiveFilter('all');
    }
  }, [activeFilter, availableFilters]);

  const normalizedSearchQuery = useMemo(
    () => deferredSearchQuery.trim().toLowerCase(),
    [deferredSearchQuery]
  );

  const filteredItems = useMemo(() => {
    const minPrice = filterPriceMin ? parseFloat(filterPriceMin) : null;
    const maxPrice = filterPriceMax ? parseFloat(filterPriceMax) : null;

    return items.filter(item => {
      if (deferredActiveFilter !== 'all' && item.status !== deferredActiveFilter) return false;

      if (normalizedSearchQuery) {
        const haystack = [
          item.name,
          item.note,
          item.link,
          item.storeName,
          item.channel,
          item.status,
          item.category
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(normalizedSearchQuery)) return false;
      }

      if (filterDateStart && item.purchaseDate < filterDateStart) return false;
      if (filterDateEnd && item.purchaseDate > filterDateEnd) return false;
      if (minPrice !== null && !Number.isNaN(minPrice) && item.price < minPrice) return false;
      if (maxPrice !== null && !Number.isNaN(maxPrice) && item.price > maxPrice) return false;

      return true;
    });
  }, [deferredActiveFilter, filterDateEnd, filterDateStart, filterPriceMax, filterPriceMin, items, normalizedSearchQuery]);

  useEffect(() => {
    if (!isActive || !onRequestImage) return undefined;
    let cancelled = false;

    const prefetch = async () => {
      const targets = filteredItems.filter(item => item.hasImage).slice(0, 12);
      for (const item of targets) {
        if (cancelled) break;
        try {
          await onRequestImage(item);
        } catch {
          // Ignore prefetch failures.
        }
      }
    };

    void prefetch();
    return () => {
      cancelled = true;
    };
  }, [filteredItems, isActive, onRequestImage]);

  const handleClearFilters = useCallback(() => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterPriceMin('');
    setFilterPriceMax('');
  }, []);

  return (
    <>
      <div className="px-6 mb-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ICONS.Search size={16} className="absolute left-4 top-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={TEXTS.searchPlaceholder[language]}
              className="w-full rounded-2xl border border-gray-100 bg-white p-4 pl-10 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowAdvancedFilters(prev => !prev)}
            className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-600 dark:bg-slate-800 dark:text-gray-300"
          >
            <ICONS.SlidersHorizontal size={16} />
            {TEXTS.advancedFilter[language]}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ml-1 mb-1 block text-[10px] font-semibold uppercase text-gray-400">{TEXTS.dateStart[language]}</label>
                <input
                  type="date"
                  value={filterDateStart}
                  onChange={event => setFilterDateStart(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 [color-scheme:light] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
              <div>
                <label className="ml-1 mb-1 block text-[10px] font-semibold uppercase text-gray-400">{TEXTS.dateEnd[language]}</label>
                <input
                  type="date"
                  value={filterDateEnd}
                  onChange={event => setFilterDateEnd(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 [color-scheme:light] dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ml-1 mb-1 block text-[10px] font-semibold uppercase text-gray-400">{TEXTS.priceMin[language]}</label>
                <input
                  type="number"
                  value={filterPriceMin}
                  onChange={event => setFilterPriceMin(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="ml-1 mb-1 block text-[10px] font-semibold uppercase text-gray-400">{TEXTS.priceMax[language]}</label>
                <input
                  type="number"
                  value={filterPriceMax}
                  onChange={event => setFilterPriceMax(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleClearFilters}
                className="rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 dark:bg-slate-800 dark:text-gray-300"
              >
                {TEXTS.clearFilter[language]}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 mb-2">
        <div className="no-scrollbar flex gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${activeFilter === 'all' ? `${themeColors.primary} text-white shadow-md` : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'}`}
          >
            {TEXTS.filterAll[language]}
          </button>
          {availableFilters.map(filterValue => (
            <button
              key={filterValue}
              onClick={() => setActiveFilter(filterValue)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${activeFilter === filterValue ? `${themeColors.primary} text-white shadow-md` : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'}`}
            >
              {getStatusLabel(filterValue)}
            </button>
          ))}
        </div>
      </div>

      <Timeline
        items={filteredItems}
        theme={theme}
        language={language}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddUsage={onAddUsage}
        onRequestImage={onRequestImage}
        onPreviewImage={onPreviewImage}
      />

      <div className="pointer-events-none fixed right-6 bottom-28 z-40 flex flex-col items-end gap-4">
        {aiEnabled && (
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => onOpenAdd('manual')}
              className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] border border-gray-100 bg-white text-gray-700 shadow-lg transition-transform hover:scale-105 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
            >
              <ICONS.Edit3 size={24} />
            </button>
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => onOpenAdd(aiEnabled ? 'ai' : 'manual')}
            className={`flex h-14 w-14 items-center justify-center rounded-[1.5rem] text-white shadow-xl transition-transform hover:scale-105 active:scale-95 ${themeColors.primary}`}
          >
            {aiEnabled ? <ICONS.Sparkles size={24} /> : <ICONS.Plus size={28} />}
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(OwnedTabContainer);
