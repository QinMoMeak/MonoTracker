import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { CATEGORY_CONFIG, ICONS, TEXTS, THEMES } from '../constants';
import { Item, Language, ThemeColor } from '../types';

const StatsTab = lazy(() => import('./StatsTab'));

type Props = {
  items: Item[];
  categories: string[];
  channels: string[];
  theme: ThemeColor;
  language: Language;
  isActive: boolean;
  formatNumber: (value: number, decimals?: number) => string;
  toNumber: (value: unknown) => number;
};

const emptyStats = {
  totalCount: 0,
  totalVal: 0,
  catStatsByValue: [],
  catStatsByCount: [],
  statusStats: [],
  durationBuckets: { '<1M': 0, '1-6M': 0, '6-12M': 0, '1-3Y': 0, '>3Y': 0 },
  timelineData: [],
  monthlySpend: [],
  channelStats: []
};

const dayMs = 1000 * 60 * 60 * 24;

const StatsTabContainer: React.FC<Props> = ({
  items,
  categories,
  channels,
  theme,
  language,
  isActive,
  formatNumber,
  toNumber
}) => {
  const [topN, setTopN] = useState(5);
  const themeColors = THEMES[theme];

  const getStatusLabel = useCallback((status: string) => {
    if (status === 'new') return TEXTS.statusNew[language];
    if (status === 'used') return TEXTS.statusUsed[language];
    if (status === 'broken') return TEXTS.statusBroken[language];
    if (status === 'sold') return TEXTS.statusSold[language];
    if (status === 'emptied') return TEXTS.statusEmptied[language];
    return status;
  }, [language]);

  const getCategoryLabel = useCallback((category: string) => {
    const config = CATEGORY_CONFIG[category];
    return config ? TEXTS[config.labelKey][language] : category;
  }, [language]);

  const getChannelLabel = useCallback((channel: string) => {
    const key = `chan${channel}`;
    return TEXTS[key] ? TEXTS[key][language] : channel;
  }, [language]);

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

  const normalizeChannelValue = useCallback((value?: string) => {
    if (!value) return '';
    return channelAliasMap.get(value) || value;
  }, [channelAliasMap]);

  const ownedItems = useMemo(() => items.filter(item => item.type === 'owned'), [items]);

  const stats = useMemo(() => {
    if (!isActive) {
      return {
        ...emptyStats,
        totalCount: ownedItems.length,
        totalVal: ownedItems.reduce((sum, item) => sum + item.price, 0)
      };
    }

    const totalCount = ownedItems.length;
    const totalVal = ownedItems.reduce((sum, item) => sum + item.price, 0);
    const allCategories = new Set([...categories, ...ownedItems.map(item => item.category)]);

    const catStats = Array.from(allCategories)
      .map(category => {
        const categoryItems = ownedItems.filter(item => (item.category || 'other') === category);
        const value = categoryItems.reduce((sum, item) => sum + item.price, 0);
        return {
          cat: category,
          count: categoryItems.length,
          value,
          percentVal: totalVal > 0 ? (value / totalVal) * 100 : 0,
          percentCount: totalCount > 0 ? (categoryItems.length / totalCount) * 100 : 0
        };
      })
      .filter(stat => stat.count > 0);

    const catStatsByValue = [...catStats].sort((a, b) => b.value - a.value);
    const catStatsByCount = [...catStats].sort((a, b) => b.count - a.count);

    const statusMap = new Map<string, number>();
    ownedItems.forEach(item => {
      const status = item.status || 'unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const statusStats = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        status,
        count,
        percent: totalCount > 0 ? (count / totalCount) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    const now = Date.now();
    const durationBuckets = { '<1M': 0, '1-6M': 0, '6-12M': 0, '1-3Y': 0, '>3Y': 0 };
    ownedItems.forEach(item => {
      const raw = new Date(item.purchaseDate).getTime();
      const purchaseTime = Number.isFinite(raw) ? raw : now;
      const days = (now - purchaseTime) / dayMs;
      if (days < 30) durationBuckets['<1M'] += 1;
      else if (days < 180) durationBuckets['1-6M'] += 1;
      else if (days < 365) durationBuckets['6-12M'] += 1;
      else if (days < 365 * 3) durationBuckets['1-3Y'] += 1;
      else durationBuckets['>3Y'] += 1;
    });

    const timelineData = [...ownedItems].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    const monthMap = new Map<string, number>();
    ownedItems.forEach(item => {
      if (!item.purchaseDate) return;
      const monthKey = item.purchaseDate.slice(0, 7);
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + toNumber(item.price));
    });
    const monthlySpend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({ month, value }));

    const channelMap = new Map<string, { value: number; count: number }>();
    ownedItems.forEach(item => {
      const channel = normalizeChannelValue(item.channel) || 'unknown';
      const current = channelMap.get(channel) || { value: 0, count: 0 };
      channelMap.set(channel, {
        value: current.value + toNumber(item.price),
        count: current.count + 1
      });
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
  }, [categories, isActive, normalizeChannelValue, ownedItems, toNumber]);

  return (
    <Suspense fallback={<div className="p-6 pb-32" />}>
      <StatsTab
        stats={stats}
        language={language}
        TEXTS={TEXTS}
        ICONS={ICONS}
        CATEGORY_CONFIG={CATEGORY_CONFIG}
        themeColors={themeColors}
        currencySymbol="\u00a5"
        formatNumber={formatNumber}
        toNumber={toNumber}
        getStatusLabel={getStatusLabel}
        getCategoryLabel={getCategoryLabel}
        getChannelLabel={getChannelLabel}
        topN={topN}
        onTopNChange={setTopN}
      />
    </Suspense>
  );
};

export default React.memo(StatsTabContainer);
