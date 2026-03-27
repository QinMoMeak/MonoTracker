import { useMemo } from 'react';
import { Item } from '../types';

export type PriceHistoryStats = {
  latest: { date: string; price: number };
  min: number;
  max: number;
  count: number;
};

export type TimelineEntryBase = {
  item: Item;
  costPerDay: number;
  costPerUse: number;
  showPerDay: boolean;
  showPerUse: boolean;
  priceHistoryStats: PriceHistoryStats | null;
};

const getDaysOwned = (dateStr: string) => {
  const start = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = now - start;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

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
  } satisfies PriceHistoryStats;
};

const getMonthKey = (purchaseDate: string) => {
  const date = new Date(purchaseDate);
  if (Number.isNaN(date.getTime())) {
    return String(purchaseDate || '').slice(0, 7) || 'unknown';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const useTimelineGroups = (items: Item[], visibleCount: number) => {
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()),
    [items]
  );

  const groupedTimeline = useMemo(() => {
    const groups = new Map<string, TimelineEntryBase[]>();

    sortedItems.slice(0, visibleCount).forEach(item => {
      const key = getMonthKey(item.purchaseDate);
      const valueDisplay = item.valueDisplay || 'both';
      const days = getDaysOwned(item.purchaseDate);
      const costPerDay = item.price / days;
      const costPerUse = item.usageCount ? item.price / item.usageCount : item.price;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)?.push({
        item,
        costPerDay,
        costPerUse,
        showPerDay: valueDisplay !== 'use',
        showPerUse: valueDisplay !== 'day',
        priceHistoryStats: getPriceHistoryStats(item.priceHistory)
      });
    });

    return {
      keys: Array.from(groups.keys()).sort((a, b) => b.localeCompare(a)),
      groups
    };
  }, [sortedItems, visibleCount]);

  return {
    sortedItems,
    groupedTimeline,
    hasMore: sortedItems.length > visibleCount
  };
};
