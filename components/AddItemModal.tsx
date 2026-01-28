
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AiRuntimeConfig, Item, Language, ThemeColor } from '../types';
import { THEMES, TEXTS, ICONS, CATEGORY_CONFIG } from '../constants';
import { analyzeItemDetails } from '../services/aiService';
import { X, Loader2, Camera, Link as LinkIcon } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<Item>) => void;
  onDelete?: (id: string) => void;
  onAlert: (message: string, title?: string) => Promise<void>;
  onConfirm: (message: string, title?: string) => Promise<boolean>;
  language: Language;
  theme: ThemeColor;
  aiConfig: AiRuntimeConfig | null;
  aiEnabled: boolean;
  activeTab: 'owned' | 'wishlist';
  initialItem?: Item | null;
  initialMode: 'ai' | 'manual';
  categories: string[];
  statuses: string[];
  channels: string[];
}

const AddItemModal: React.FC<Props> = ({ 
  isOpen, onClose, onSave, onDelete, onAlert, onConfirm, language, theme, aiConfig, aiEnabled, activeTab, initialItem, initialMode,
  categories, statuses, channels
}) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [images, setImages] = useState<string[]>([]);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyPrice, setHistoryPrice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form State
  const [formData, setFormData] = useState<Partial<Item>>({
    name: '', price: 0, msrp: 0, quantity: 1, avgPrice: 0, note: '', link: '', storeName: '', status: 'new', category: 'other', channel: '', type: activeTab, purchaseDate: new Date().toISOString().split('T')[0], priceHistory: [], valueDisplay: 'both'
  });

  const computeAvgPrice = (price: number, quantity: number) => {
    const safeQuantity = quantity > 0 ? quantity : 1;
    return Number((price / safeQuantity).toFixed(2));
  };

  // Reset or Populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setMode('manual');
        const quantity = Math.max(1, Math.floor(Number(initialItem.quantity || 1)));
        const price = typeof initialItem.price === 'number' ? initialItem.price : 0;
        const avgPrice = typeof initialItem.avgPrice === 'number' ? initialItem.avgPrice : computeAvgPrice(price, quantity);
        setFormData({ ...initialItem, quantity, avgPrice, storeName: initialItem.storeName || '', channel: normalizeChannelValue(initialItem.channel), valueDisplay: initialItem.valueDisplay || 'both' });
        setImage(initialItem.image);
        setImages(initialItem.image ? [initialItem.image] : []);
        setDesc('');
        setHistoryDate(new Date().toISOString().split('T')[0]);
        setHistoryPrice('');
      } else {
        // Use the passed initialMode (ai or manual)
        setMode(aiEnabled ? initialMode : 'manual');
        setFormData({ 
          name: '', price: 0, msrp: 0, quantity: 1, avgPrice: 0, note: '', link: '', storeName: '', status: 'new', category: 'other', channel: '', type: activeTab, purchaseDate: new Date().toISOString().split('T')[0], priceHistory: [], valueDisplay: 'both' 
        });
        setImage(undefined);
        setImages([]);
        setDesc('');
        setHistoryDate(new Date().toISOString().split('T')[0]);
        setHistoryPrice('');
      }
    }
  }, [isOpen, initialItem, activeTab, initialMode, aiEnabled]);

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

  const handleFocusCapture = (event: React.FocusEvent) => {
    const target = event.target as HTMLElement;
    if (!target || typeof target.scrollIntoView !== 'function') return;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  const themeColors = THEMES[theme];
  const currencySymbol = '\u00a5';
  const allChannels = channels;

  const channelLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    allChannels.forEach(c => {
      const key = `chan${c}`;
      map.set(c, TEXTS[key] ? TEXTS[key][language] : c);
    });
    return map;
  }, [allChannels, language]);

  const channelLabelToKeyMap = useMemo(() => {
    const map = new Map<string, string>();
    channelLabelMap.forEach((label, key) => {
      map.set(label, key);
    });
    return map;
  }, [channelLabelMap]);

  const getChannelLabel = (channel: string) =>
    channelLabelMap.get(channel) || channel;

  const normalizeChannelValue = (value?: string) => {
    if (!value) return '';
    return channelLabelToKeyMap.get(value) || value;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    const readFile = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

    try {
      const dataUrls = await Promise.all(fileList.map(readFile));
      setImages(dataUrls);
      setImage(dataUrls[0]);
    } catch {
      await onAlert(TEXTS.aiAnalyzeFailed[language]);
    } finally {
      e.target.value = '';
    }
  };


  const handleAiAnalyze = async () => {
    if (!desc && !image) return;
    if (!aiEnabled || !aiConfig || aiConfig.provider === 'disabled') {
      await onAlert(TEXTS.aiMissingProvider[language]);
      return;
    }
    if (!aiConfig.apiKey) {
      await onAlert(TEXTS.aiMissingKey[language]);
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await analyzeItemDetails(aiConfig, {
        text: desc,
        imageBase64: image,
        imageBase64s: images.length ? images : undefined,
        categories,
        statuses,
        channels,
        today,
        language
      });
      const price = typeof result.price === 'number' ? result.price : parseFloat(String(result.price || '')) || 0;
      const msrp = typeof result.msrp === 'number' ? result.msrp : parseFloat(String(result.msrp || '')) || 0;
      const storeName = typeof result.storeName === 'string' ? result.storeName : '';
      const nextQuantity = Math.max(1, Math.floor(Number(result.quantity || 0) || (Number(formData.quantity || 1) || 1)));
      const nextAvgPrice = computeAvgPrice(price, nextQuantity);
      setFormData(prev => {
        const nextChannel = normalizeChannelValue(result.channel || prev.channel);
        const resolvedType = activeTab === 'wishlist' ? 'wishlist' : (result.type || prev.type || activeTab);
        return ({
          ...prev,
          ...result,
          quantity: nextQuantity,
          avgPrice: typeof result.avgPrice === 'number' ? result.avgPrice : nextAvgPrice,
          storeName: storeName || prev.storeName || '',
          price,
          msrp: msrp || price,
          purchaseDate: result.purchaseDate || today,
          status: result.status || prev.status,
          category: result.category || prev.category,
          channel: nextChannel,
          image: image || result.image,
          type: resolvedType
        });
      });
      setMode('manual'); 
    } catch (error) {
      await onAlert(TEXTS.aiAnalyzeFailed[language]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    const quantity = Math.max(1, Math.floor(Number(formData.quantity || 1)));
    const price = Number(formData.price || 0);
    const avgPrice = computeAvgPrice(price, quantity);
    onSave({ 
        ...formData,
        quantity,
        avgPrice,
        channel: normalizeChannelValue(formData.channel),
        image, 
        usageCount: formData.usageCount || 0,
        discountRate: formData.price && formData.msrp ? ((formData.msrp - formData.price) / formData.msrp) * 100 : 0
    });
  };

  const handleAddPricePoint = async () => {
    const priceValue = parseFloat(historyPrice);
    if (!historyDate || Number.isNaN(priceValue) || priceValue <= 0) {
      await onAlert(TEXTS.priceHistoryInvalid[language]);
      return;
    }
    setFormData(prev => {
      const current = Array.isArray(prev.priceHistory) ? prev.priceHistory : [];
      return {
        ...prev,
        priceHistory: [...current, { date: historyDate, price: priceValue }]
      };
    });
    setHistoryPrice('');
  };

  const handleRemovePricePoint = (index: number) => {
    setFormData(prev => {
      const current = Array.isArray(prev.priceHistory) ? prev.priceHistory : [];
      return {
        ...prev,
        priceHistory: current.filter((_, i) => i !== index)
      };
    });
  };

  const handleDelete = async () => {
    if (!initialItem?.id || !onDelete) return;
    const confirmed = await onConfirm(TEXTS.deleteConfirm[language]);
    if (!confirmed) return;
    onDelete(initialItem.id);
    onClose();
  };

  const statusOptions = statuses.length ? statuses : ['new'];
  const allCategories = categories.length ? categories : ['other'];
  const showPriceHistory = formData.type === 'wishlist';
  const sortedPriceHistory = useMemo(() => {
    const current = Array.isArray(formData.priceHistory) ? formData.priceHistory : [];
    return [...current].sort((a, b) => a.date.localeCompare(b.date));
  }, [formData.priceHistory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} style={{pointerEvents: 'auto'}} />
      
      <div
        className={`
        relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl 
        transform transition-transform duration-300 max-h-[88svh] overflow-y-auto no-scrollbar overscroll-contain pointer-events-auto
        ${themeColors.surface}
      `}
        onFocusCapture={handleFocusCapture}
        style={{ WebkitOverflowScrolling: 'touch', paddingBottom: keyboardInset ? keyboardInset + 16 : undefined }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {initialItem ? TEXTS.editItem[language] : (mode === 'ai' ? TEXTS.quickAdd[language] : TEXTS.addItem[language])}
          </h2>
          <button type="button" onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* AI Mode */}
        {mode === 'ai' && aiEnabled && (
          <div className="space-y-6 pb-16">
            <div 
              className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              {images.length > 0 ? (
                <div className="relative">
                  <img src={images[0]} alt={TEXTS.imagePreviewAlt[language]} className="h-40 object-contain rounded-xl" />
                  {images.length > 1 && (
                    <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-gray-800 text-white rounded-full px-2 py-0.5 shadow">
                      +{images.length - 1}
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <Camera size={40} className="text-gray-400 dark:text-slate-500 mb-2" />
                  <p className="text-gray-500 dark:text-slate-400 text-sm">{TEXTS.analyzeDesc[language]}</p>
                </>
              )}
              <input type="file" ref={fileInputRef} hidden accept="image/*" multiple onChange={handleImageUpload} />
            </div>

            <textarea
              className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-opacity-50 resize-none h-32 placeholder-gray-400 dark:placeholder-slate-500"
              style={{ '--tw-ring-color': `var(--theme-color-${theme})` } as any}
              placeholder={TEXTS.placeholderDesc[language]}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setMode('manual')}
                className="flex-1 py-4 rounded-full font-semibold bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors"
              >
                {TEXTS.manualAdd[language]}
              </button>
              <button 
                type="button"
                onClick={handleAiAnalyze}
                disabled={loading || (!desc && !image)}
                className={`flex-1 py-4 rounded-full font-semibold text-white flex items-center justify-center gap-2 ${themeColors.primary} ${(loading || (!desc && !image)) ? 'opacity-50' : ''}`}
              >
                {loading ? <Loader2 className="animate-spin" /> : <ICONS.Sparkles size={20} />}
                {loading ? TEXTS.analyzing[language] : TEXTS.quickAdd[language]}
              </button>
            </div>
          </div>
        )}

        {/* Manual Mode */}
        {mode === 'manual' && (
          <div className="space-y-4 pb-20">
            <div className="flex justify-center mb-4 cursor-pointer" onClick={() => {
              fileInputRef.current?.click();
            }}>
                {image ? (
                  <div className="relative">
                    <img src={image} alt={TEXTS.imagePreviewAlt[language]} className="h-32 rounded-xl object-cover shadow-sm" />
                    {images.length > 1 && (
                      <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-gray-800 text-white rounded-full px-2 py-0.5 shadow">
                        +{images.length - 1}
                      </span>
                    )}
                  </div>
                ) : (
                   <div className="h-32 w-full bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 border-dashed">
                      <div className="flex flex-col items-center gap-2">
                        <Camera size={24} />
                        <span className="text-xs">{TEXTS.addImage[language]}</span>
                      </div>
                   </div>
                )}
                <input type="file" ref={fileInputRef} hidden accept="image/*" multiple onChange={handleImageUpload} />
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.name[language]}</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm focus:ring-2 dark:placeholder-slate-500"
                placeholder={TEXTS.itemNamePlaceholder[language]}
              />
            </div>

            {/* Item Type */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.itemType[language]}</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'owned' })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    formData.type === 'owned'
                    ? `${themeColors.primary} text-white border-transparent shadow-md`
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {TEXTS.tabOwned[language]}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'wishlist' })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    formData.type === 'wishlist'
                    ? `${themeColors.primary} text-white border-transparent shadow-md`
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {TEXTS.tabWishlist[language]}
                </button>
              </div>
            </div>

            {/* Price & MSRP */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.price[language]}</label>
                <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-400">{currencySymbol}</span>
                    <input 
                        type="number"
                        value={formData.price}
                        onChange={e => {
                          const nextPrice = parseFloat(e.target.value) || 0;
                          const qty = Number(formData.quantity || 1);
                          setFormData({ ...formData, price: nextPrice, avgPrice: computeAvgPrice(nextPrice, qty) });
                        }}
                        className="w-full p-4 pl-8 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm"
                    />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.msrp[language]}</label>
                <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-400">{currencySymbol}</span>
                    <input 
                        type="number"
                        value={formData.msrp}
                        onChange={e => setFormData({...formData, msrp: parseFloat(e.target.value)})}
                        className="w-full p-4 pl-8 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm"
                    />
                </div>
              </div>
            </div>

            {/* Quantity & Avg Price */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.quantity[language]}</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.quantity}
                  onChange={e => {
                    const nextQuantity = Math.max(1, Math.floor(parseFloat(e.target.value) || 1));
                    const price = Number(formData.price || 0);
                    setFormData({ ...formData, quantity: nextQuantity, avgPrice: computeAvgPrice(price, nextQuantity) });
                  }}
                  className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.avgPrice[language]}</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-gray-400">{currencySymbol}</span>
                  <input
                    type="number"
                    value={formData.avgPrice}
                    readOnly
                    className="w-full p-4 pl-8 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm opacity-80"
                  />
                </div>
              </div>
            </div>

            {/* Wishlist Price History */}
            {showPriceHistory && (
              <div className="bg-gray-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-3 border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{TEXTS.priceHistory[language]}</label>
                  <span className="text-[10px] text-gray-400">{TEXTS.priceHistoryTip[language]}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 ml-1 mb-1 block uppercase">{TEXTS.priceHistoryDate[language]}</label>
                    <input
                      type="date"
                      value={historyDate}
                      onChange={e => setHistoryDate(e.target.value)}
                      className="w-full p-3 bg-white dark:bg-slate-800 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 ml-1 mb-1 block uppercase">{TEXTS.priceHistoryPrice[language]}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-gray-400">{currencySymbol}</span>
                      <input
                        type="number"
                        value={historyPrice}
                        onChange={e => setHistoryPrice(e.target.value)}
                        className="w-full p-3 pl-7 bg-white dark:bg-slate-800 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddPricePoint}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold text-white ${themeColors.primary}`}
                >
                  {TEXTS.priceHistoryAdd[language]}
                </button>

                <div className="space-y-2">
                  {sortedPriceHistory.length === 0 && (
                    <p className="text-xs text-gray-400">{TEXTS.priceHistoryEmpty[language]}</p>
                  )}
                  {sortedPriceHistory.map((point, index) => (
                    <div key={`${point.date}-${index}`} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-3 py-2 border border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-gray-400 font-mono">{point.date}</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">{currencySymbol}{point.price.toFixed(2)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePricePoint(index)}
                        className="text-rose-500 hover:text-rose-600"
                      >
                        <ICONS.Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date */}
            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.date[language]}</label>
                <div className="relative">
                    <ICONS.Calendar size={16} className="absolute left-4 top-4 text-gray-400" />
                    <input 
                        type="date"
                        value={formData.purchaseDate}
                        onChange={e => setFormData({...formData, purchaseDate: e.target.value})}
                        className="w-full p-4 pl-10 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </div>
            </div>

            {/* Category Selection */}
            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.category[language]}</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                    {allCategories.map(cat => {
                        const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['other'];
                        const Icon = config.icon;
                        const isSelected = formData.category === cat;
                        const label = CATEGORY_CONFIG[cat] ? TEXTS[config.labelKey][language] : cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setFormData({...formData, category: cat})}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all border ${
                                    isSelected 
                                    ? `${themeColors.primary} text-white shadow-md border-transparent` 
                                    : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <Icon size={20} className="mb-1" />
                                <span className="text-[10px] font-medium truncate w-full text-center">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Status Selection */}
            <div>
                 <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.status[language]}</label>
                 <div className="flex flex-wrap gap-2 mb-2">
                    {statusOptions.map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({...formData, status: s})}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
                                formData.status === s 
                                ? `${themeColors.primary} text-white border-transparent shadow-md` 
                                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {/* Map status to localized text, or show raw if custom */}
                            {s === 'new' ? TEXTS.statusNew[language] : 
                             s === 'used' ? TEXTS.statusUsed[language] : 
                             s === 'broken' ? TEXTS.statusBroken[language] : 
                             s === 'sold' ? TEXTS.statusSold[language] :
                             s === 'emptied' ? TEXTS.statusEmptied[language] :
                             s}
                        </button>
                    ))}
                    {/* Show selected custom status if not in options */}
                    {formData.status && !statusOptions.includes(formData.status as any) && (
                        <button
                            type="button"
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${themeColors.primary} text-white border-transparent shadow-md`}
                        >
                            {formData.status}
                        </button>
                    )}

                 </div>
            </div>

            {/* Value Display (Owned Only) */}
            {formData.type === 'owned' && (
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.valueDisplay[language]}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(['day', 'use', 'both'] as const).map(option => {
                    const label = option === 'day'
                      ? TEXTS.valPerDay[language]
                      : option === 'use'
                        ? TEXTS.valPerUse[language]
                        : TEXTS.valueDisplayBoth[language];
                    const selected = (formData.valueDisplay || 'both') === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFormData({ ...formData, valueDisplay: option })}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
                          selected
                          ? `${themeColors.primary} text-white border-transparent shadow-md`
                          : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Channel Selection */}
            <div>
                 <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.channel[language]}</label>
                 <div className="flex flex-wrap gap-2 mb-2">
                    {allChannels.map(c => {
                        const label = getChannelLabel(c);
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setFormData({...formData, channel: c})}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
                                    formData.channel === c 
                                    ? `${themeColors.primary} text-white border-transparent shadow-md` 
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                    {formData.channel && !allChannels.includes(formData.channel) && (
                        <button
                            type="button"
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${themeColors.primary} text-white border-transparent shadow-md`}
                        >
                            {getChannelLabel(formData.channel)}
                        </button>
                    )}
                 </div>
            </div>

            {/* Store Name */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.storeName[language]}</label>
              <input
                value={formData.storeName || ''}
                onChange={e => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm placeholder-gray-400 dark:placeholder-slate-500"
                placeholder={TEXTS.storeNamePlaceholder[language]}
              />
            </div>

             {/* Link */}
             <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.link[language]}</label>
              <div className="relative">
                <LinkIcon size={16} className="absolute left-4 top-4 text-gray-400" />
                <input 
                    value={formData.link}
                    onChange={e => setFormData({...formData, link: e.target.value})}
                    className="w-full p-4 pl-10 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm placeholder-gray-400 dark:placeholder-slate-500"
                    placeholder={TEXTS.linkPlaceholder[language]}
                />
              </div>
            </div>

            {/* Note */}
             <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.note[language]}</label>
              <textarea 
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
                className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm h-24 placeholder-gray-400 dark:placeholder-slate-500"
              />
            </div>

            <div className={`sticky bottom-0 pt-4 pb-2 rounded-2xl ${themeColors.surface}`}>
              <button 
                type="button"
                onClick={handleSubmit}
                className={`w-full py-4 rounded-full font-bold text-white text-lg shadow-lg ${themeColors.primary}`}
              >
                {TEXTS.save[language]}
              </button>
              {initialItem && (
                <button 
                  type="button"
                  onClick={handleDelete}
                  className="w-full py-3 mt-3 rounded-full font-semibold border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-slate-900 dark:text-rose-300 dark:border-rose-900/40"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <ICONS.Trash2 size={18} />
                    {TEXTS.delete[language]}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddItemModal;
