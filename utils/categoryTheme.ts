import { CategoryVisualConfig } from '../types';

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(part => `${part}${part}`).join('')
    : normalized;
  const value = Number.parseInt(full.slice(0, 6), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getCategoryBadgeStyle = (config: CategoryVisualConfig) => ({
  backgroundColor: withAlpha(config.accent, 0.14),
  color: config.accent
});

export const getCategoryBarStyle = (config: CategoryVisualConfig) => ({
  backgroundColor: config.accent
});

export const getCategoryIconStyle = (config: CategoryVisualConfig) => ({
  color: config.accent
});
