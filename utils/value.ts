import { Item } from '../types';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const toDateAtLocalMidnight = (value?: string) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const getItemDaysUsed = (item: Pick<Item, 'purchaseDate' | 'lastUsedDate'>, now = new Date()) => {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const baseDate = toDateAtLocalMidnight(item.lastUsedDate) || toDateAtLocalMidnight(item.purchaseDate);
  if (!baseDate) return 1;

  const diff = end.getTime() - baseDate.getTime();
  return Math.max(1, Math.floor(diff / DAY_IN_MS) + 1);
};

export const getItemCostPerDay = (
  item: Pick<Item, 'price' | 'purchaseDate' | 'lastUsedDate'>,
  now = new Date()
) => {
  const daysUsed = getItemDaysUsed(item, now);
  const price = Number.isFinite(item.price) ? item.price : 0;
  return {
    daysUsed,
    costPerDay: daysUsed > 0 ? price / daysUsed : price
  };
};
