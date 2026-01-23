import React, { useEffect, useState } from 'react';
import { ThemeColor } from '../types';
import { THEMES, ICONS } from '../constants';

type DialogType = 'alert' | 'confirm' | 'prompt';

interface DialogProps {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  theme: ThemeColor;
  defaultValue?: string;
  placeholder?: string;
  onConfirm: (value?: string) => void;
  onCancel?: () => void;
}

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  type,
  title,
  message,
  confirmText,
  cancelText,
  theme,
  defaultValue,
  placeholder,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue || '');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const themeColors = THEMES[theme];

  useEffect(() => {
    if (isOpen) setValue(defaultValue || '');
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset);
    };

    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);

    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const showCancel = type === 'confirm' || type === 'prompt';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
        style={{ pointerEvents: 'auto' }}
      />
      <div
        className={`relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl pointer-events-auto ${themeColors.surface}`}
        style={{ marginBottom: keyboardInset ? keyboardInset + 8 : undefined }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
            >
              <ICONS.X size={18} />
            </button>
          )}
        </div>

        {message && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 whitespace-pre-line">{message}</p>}

        {type === 'prompt' && (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => {
              setTimeout(() => {
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 200);
            }}
            placeholder={placeholder}
            className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50 mb-5"
            style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
          />
        )}

        <div className="flex gap-3">
          {showCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-full font-semibold bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm(type === 'prompt' ? value.trim() : undefined)}
            className={`flex-1 py-3 rounded-full font-semibold text-white shadow-lg ${themeColors.primary}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dialog;
