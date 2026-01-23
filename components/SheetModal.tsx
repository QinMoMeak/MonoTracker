import React, { useEffect, useState } from 'react';
import { ThemeColor } from '../types';
import { THEMES, ICONS } from '../constants';

interface SheetModalProps {
  isOpen: boolean;
  title: string;
  theme: ThemeColor;
  onClose: () => void;
  children: React.ReactNode;
}

const SheetModal: React.FC<SheetModalProps> = ({ isOpen, title, theme, onClose, children }) => {
  const [keyboardInset, setKeyboardInset] = useState(0);
  const themeColors = THEMES[theme];

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

  const handleFocusCapture = (event: React.FocusEvent) => {
    const target = event.target as HTMLElement;
    if (!target || typeof target.scrollIntoView !== 'function') return;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} style={{ pointerEvents: 'auto' }} />
      <div
        className={`
          relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl
          transform transition-transform duration-300 max-h-[88svh] overflow-y-auto no-scrollbar overscroll-contain pointer-events-auto
          ${themeColors.surface}
        `}
        onFocusCapture={handleFocusCapture}
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: keyboardInset ? keyboardInset + 16 : undefined }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200">
            <ICONS.X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default SheetModal;
