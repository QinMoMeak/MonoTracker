import { Capacitor, registerPlugin } from '@capacitor/core';
import { AppearanceMode, MaterialThemeTokens, ThemeColor } from '../types';

interface NativeDynamicThemePlugin {
  getMaterialTheme(options: { isDark: boolean }): Promise<{
    supported: boolean;
    isDynamic: boolean;
    tokens?: MaterialThemeTokens;
  }>;
}

const NativeDynamicTheme = registerPlugin<NativeDynamicThemePlugin>('DynamicThemePlugin');

type ThemeVariant = 'light' | 'dark';

const STATIC_TOKENS: Record<ThemeColor, Record<ThemeVariant, MaterialThemeTokens>> = {
  blue: {
    light: {
      primary: '#295EA7',
      onPrimary: '#FFFFFF',
      primaryContainer: '#D6E3FF',
      onPrimaryContainer: '#001B3F',
      secondary: '#545F70',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#D8E3F7',
      onSecondaryContainer: '#111C2B',
      surface: '#F8F9FF',
      onSurface: '#191C20',
      surfaceVariant: '#DDE3EC',
      onSurfaceVariant: '#414852',
      outline: '#717782',
      error: '#BA1A1A'
    },
    dark: {
      primary: '#AAC8FF',
      onPrimary: '#002F65',
      primaryContainer: '#08458D',
      onPrimaryContainer: '#D6E3FF',
      secondary: '#BCC7DB',
      onSecondary: '#263141',
      secondaryContainer: '#3C4758',
      onSecondaryContainer: '#D8E3F7',
      surface: '#101418',
      onSurface: '#E1E2E8',
      surfaceVariant: '#414852',
      onSurfaceVariant: '#C1C7D0',
      outline: '#8B919B',
      error: '#FFB4AB'
    }
  },
  green: {
    light: {
      primary: '#166E49',
      onPrimary: '#FFFFFF',
      primaryContainer: '#A5F2C7',
      onPrimaryContainer: '#002112',
      secondary: '#4F6354',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#D1E8D5',
      onSecondaryContainer: '#0D1F14',
      surface: '#F6FBF5',
      onSurface: '#171D18',
      surfaceVariant: '#DCE5DB',
      onSurfaceVariant: '#404942',
      outline: '#707972',
      error: '#BA1A1A'
    },
    dark: {
      primary: '#89D5AC',
      onPrimary: '#003824',
      primaryContainer: '#005235',
      onPrimaryContainer: '#A5F2C7',
      secondary: '#B5CCB8',
      onSecondary: '#223526',
      secondaryContainer: '#384B3C',
      onSecondaryContainer: '#D1E8D5',
      surface: '#0F1511',
      onSurface: '#DFE5DD',
      surfaceVariant: '#404942',
      onSurfaceVariant: '#C0C9BF',
      outline: '#8A938B',
      error: '#FFB4AB'
    }
  },
  violet: {
    light: {
      primary: '#7051C8',
      onPrimary: '#FFFFFF',
      primaryContainer: '#EADCFF',
      onPrimaryContainer: '#25005A',
      secondary: '#625B71',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#E8DEF8',
      onSecondaryContainer: '#1E192B',
      surface: '#FCF8FF',
      onSurface: '#1D1B20',
      surfaceVariant: '#E6E0EB',
      onSurfaceVariant: '#49454F',
      outline: '#7A757F',
      error: '#BA1A1A'
    },
    dark: {
      primary: '#D1BCFF',
      onPrimary: '#3C1B92',
      primaryContainer: '#5633AA',
      onPrimaryContainer: '#EADCFF',
      secondary: '#CCC2DB',
      onSecondary: '#332D41',
      secondaryContainer: '#4A4458',
      onSecondaryContainer: '#E8DEF8',
      surface: '#141218',
      onSurface: '#E6E0E8',
      surfaceVariant: '#49454F',
      onSurfaceVariant: '#CAC4CF',
      outline: '#948F99',
      error: '#FFB4AB'
    }
  },
  orange: {
    light: {
      primary: '#A24C00',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFDBC6',
      onPrimaryContainer: '#341100',
      secondary: '#765847',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#FFDBC9',
      onSecondaryContainer: '#2B170A',
      surface: '#FFF8F5',
      onSurface: '#231A15',
      surfaceVariant: '#F4DED2',
      onSurfaceVariant: '#53433A',
      outline: '#857369',
      error: '#BA1A1A'
    },
    dark: {
      primary: '#FFB784',
      onPrimary: '#552000',
      primaryContainer: '#7A3300',
      onPrimaryContainer: '#FFDBC6',
      secondary: '#E6BEA8',
      onSecondary: '#442A1B',
      secondaryContainer: '#5D4030',
      onSecondaryContainer: '#FFDBC9',
      surface: '#1A120E',
      onSurface: '#F0DFD7',
      surfaceVariant: '#53433A',
      onSurfaceVariant: '#D7C2B7',
      outline: '#A08D83',
      error: '#FFB4AB'
    }
  },
  rose: {
    light: {
      primary: '#B4235A',
      onPrimary: '#FFFFFF',
      primaryContainer: '#FFD9E2',
      onPrimaryContainer: '#3F001A',
      secondary: '#74565F',
      onSecondary: '#FFFFFF',
      secondaryContainer: '#FFD9E2',
      onSecondaryContainer: '#2B151B',
      surface: '#FFF8F8',
      onSurface: '#23191C',
      surfaceVariant: '#F2DDE2',
      onSurfaceVariant: '#514348',
      outline: '#837378',
      error: '#BA1A1A'
    },
    dark: {
      primary: '#FFAFC5',
      onPrimary: '#65002B',
      primaryContainer: '#8E0D43',
      onPrimaryContainer: '#FFD9E2',
      secondary: '#E2BDC7',
      onSecondary: '#422931',
      secondaryContainer: '#5A3F47',
      onSecondaryContainer: '#FFD9E2',
      surface: '#1A1114',
      onSurface: '#EDDDE1',
      surfaceVariant: '#514348',
      onSurfaceVariant: '#D5C2C7',
      outline: '#9E8C91',
      error: '#FFB4AB'
    }
  }
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(part => `${part}${part}`).join('')
    : normalized;
  const value = Number.parseInt(full.slice(0, 6), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

const mixHex = (baseHex: string, overlayHex: string, ratio: number) => {
  const base = hexToRgb(baseHex).split(' ').map(Number);
  const overlay = hexToRgb(overlayHex).split(' ').map(Number);
  const mixed = base.map((value, index) => Math.round(value + (overlay[index] - value) * ratio));
  return `#${mixed.map(value => value.toString(16).padStart(2, '0')).join('')}`;
};

export const resolveIsDarkMode = (appearance: AppearanceMode, systemPrefersDark: boolean) =>
  appearance === 'dark' || (appearance === 'system' && systemPrefersDark);

export const getStaticMaterialTheme = (theme: ThemeColor, isDark: boolean) =>
  STATIC_TOKENS[theme][isDark ? 'dark' : 'light'];

export const loadMaterialTheme = async (theme: ThemeColor, isDark: boolean, preferDynamic: boolean) => {
  if (preferDynamic && Capacitor.getPlatform() === 'android') {
    try {
      const result = await NativeDynamicTheme.getMaterialTheme({ isDark });
      if (result?.supported && result?.tokens) {
        return {
          tokens: result.tokens,
          isDynamic: Boolean(result.isDynamic),
          supported: true
        };
      }
      return {
        tokens: getStaticMaterialTheme(theme, isDark),
        isDynamic: false,
        supported: Boolean(result?.supported)
      };
    } catch {
      // Fall back to static tokens when the native bridge is unavailable.
    }
  }

  return {
    tokens: getStaticMaterialTheme(theme, isDark),
    isDynamic: false,
    supported: false
  };
};

export const applyMaterialTheme = (tokens: MaterialThemeTokens) => {
  const root = document.documentElement;
  const card = mixHex(tokens.surface, tokens.surfaceVariant, 0.42);
  const mutedCard = mixHex(tokens.surface, tokens.primaryContainer, 0.26);
  const nav = mixHex(tokens.surface, tokens.surfaceVariant, 0.58);

  root.style.setProperty('--md-primary', tokens.primary);
  root.style.setProperty('--md-on-primary', tokens.onPrimary);
  root.style.setProperty('--md-primary-container', tokens.primaryContainer);
  root.style.setProperty('--md-on-primary-container', tokens.onPrimaryContainer);
  root.style.setProperty('--md-secondary', tokens.secondary);
  root.style.setProperty('--md-on-secondary', tokens.onSecondary);
  root.style.setProperty('--md-secondary-container', tokens.secondaryContainer);
  root.style.setProperty('--md-on-secondary-container', tokens.onSecondaryContainer);
  root.style.setProperty('--md-surface', tokens.surface);
  root.style.setProperty('--md-on-surface', tokens.onSurface);
  root.style.setProperty('--md-surface-variant', tokens.surfaceVariant);
  root.style.setProperty('--md-on-surface-variant', tokens.onSurfaceVariant);
  root.style.setProperty('--md-outline', tokens.outline);
  root.style.setProperty('--md-error', tokens.error);

  root.style.setProperty('--md-primary-rgb', hexToRgb(tokens.primary));
  root.style.setProperty('--md-surface-rgb', hexToRgb(tokens.surface));
  root.style.setProperty('--md-outline-rgb', hexToRgb(tokens.outline));
  root.style.setProperty('--md-error-rgb', hexToRgb(tokens.error));
  root.style.setProperty('--app-bg', tokens.surface);
  root.style.setProperty('--app-card', card);
  root.style.setProperty('--app-card-muted', mutedCard);
  root.style.setProperty('--app-nav-bg', `rgba(${hexToRgb(nav)}, 0.94)`);
};
