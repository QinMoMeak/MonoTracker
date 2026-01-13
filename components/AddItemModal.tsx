import React, { useState, useRef, useEffect } from 'react';
import { Item, Language, ThemeColor, CategoryType } from '../types';
import { THEMES, TEXTS, ICONS, CATEGORY_CONFIG } from '../constants';
import { extractItemDetails } from '../services/geminiService';
import { X, Loader2, Camera, Link as LinkIcon, Tag } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<Item>) => void;
  language: Language;
  theme: ThemeColor;
  activeTab: 'owned' | 'wishlist';
  initialItem?: Item | null;
  initialMode: 'ai' | 'manual';
}

const AddItemModal: React.FC<Props> = ({ isOpen, onClose, onSave, language, theme, activeTab, initialItem, initialMode }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form State
  const [formData, setFormData] = useState<Partial<Item>>({
    name: '', price: 0, msrp: 0, note: '', link: '', status: 'new', category: 'other', type: activeTab, purchaseDate: new Date().toISOString().split('T')[0]
  });

  // Reset or Populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setMode('manual');
        setFormData({ ...initialItem });
        setImage(initialItem.image);
        setDesc('');
      } else {
        // Use the passed initialMode (ai or manual)
        setMode(initialMode);
        setFormData({ 
          name: '', price: 0, msrp: 0, note: '', link: '', status: 'new', category: 'other', type: activeTab, purchaseDate: new Date().toISOString().split('T')[0] 
        });
        setImage(undefined);
        setDesc('');
      }
    }
  }, [isOpen, initialItem, activeTab, initialMode]);

  if (!isOpen) return null;

  const themeColors = THEMES[theme];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiAnalyze = async () => {
    if (!desc && !image) return;
    setLoading(true);
    try {
      const result = await extractItemDetails(desc, image);
      setFormData(prev => ({
        ...prev,
        ...result,
        image: image || result.image, 
        type: activeTab // Default to current tab, can be changed in manual review
      }));
      setMode('manual'); 
    } catch (error) {
      alert('AI analysis failed. Please try manual entry.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    onSave({ 
        ...formData, 
        image, 
        usageCount: formData.usageCount || 0,
        discountRate: formData.price && formData.msrp ? ((formData.msrp - formData.price) / formData.msrp) * 100 : 0
    });
    onClose();
  };

  const statusOptions = ['new', 'used', 'broken', 'sold'] as const;
  const categories = Object.keys(CATEGORY_CONFIG) as CategoryType[];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} style={{pointerEvents: 'auto'}} />
      
      <div className={`
        relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl 
        transform transition-transform duration-300 max-h-[90dvh] overflow-y-auto no-scrollbar pointer-events-auto
        ${themeColors.surface}
      `}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {initialItem ? TEXTS.editItem[language] : (mode === 'ai' ? TEXTS.quickAdd[language] : TEXTS.addItem[language])}
          </h2>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* AI Mode */}
        {mode === 'ai' && (
          <div className="space-y-6 pb-40">
            <div 
              className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {image ? (
                <img src={image} alt="Preview" className="h-40 object-contain rounded-xl" />
              ) : (
                <>
                  <Camera size={40} className="text-gray-400 dark:text-slate-500 mb-2" />
                  <p className="text-gray-500 dark:text-slate-400 text-sm">{TEXTS.analyzeDesc[language]}</p>
                </>
              )}
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
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
                onClick={() => setMode('manual')}
                className="flex-1 py-4 rounded-full font-semibold bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors"
              >
                {TEXTS.manualAdd[language]}
              </button>
              <button 
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
          <div className="space-y-4 pb-40">
            <div className="flex justify-center mb-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {image ? (
                   <img src={image} className="h-32 rounded-xl object-cover shadow-sm" />
                ) : (
                   <div className="h-32 w-full bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 border-dashed">
                      <div className="flex flex-col items-center gap-2">
                        <Camera size={24} />
                        <span className="text-xs">Add Image</span>
                      </div>
                   </div>
                )}
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
            </div>

            {/* Name */}
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.name[language]}</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm focus:ring-2 dark:placeholder-slate-500"
                placeholder="Item Name"
              />
            </div>

            {/* Price & MSRP */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.price[language]}</label>
                <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-400">¥</span>
                    <input 
                        type="number"
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                        className="w-full p-4 pl-8 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm"
                    />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.msrp[language]}</label>
                <div className="relative">
                    <span className="absolute left-4 top-4 text-gray-400">¥</span>
                    <input 
                        type="number"
                        value={formData.msrp}
                        onChange={e => setFormData({...formData, msrp: parseFloat(e.target.value)})}
                        className="w-full p-4 pl-8 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm"
                    />
                </div>
              </div>
            </div>

            {/* Date */}
            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.date[language]}</label>
                <input 
                    type="date"
                    value={formData.purchaseDate}
                    onChange={e => setFormData({...formData, purchaseDate: e.target.value})}
                    className="w-full p-4 bg-white dark:bg-slate-800 dark:text-white rounded-2xl border-none shadow-sm [color-scheme:light] dark:[color-scheme:dark]"
                />
            </div>

            {/* Category Selection */}
            <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.category[language]}</label>
                <div className="grid grid-cols-4 gap-2">
                    {categories.map(cat => {
                        const config = CATEGORY_CONFIG[cat];
                        const Icon = config.icon;
                        const isSelected = formData.category === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setFormData({...formData, category: cat})}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all border ${
                                    isSelected 
                                    ? `${themeColors.primary} text-white shadow-md border-transparent` 
                                    : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <Icon size={20} className="mb-1" />
                                <span className="text-[10px] font-medium">{TEXTS[config.labelKey][language]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Status Selection */}
            <div>
                 <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-2 mb-1 block uppercase">{TEXTS.status[language]}</label>
                 <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    {statusOptions.map(s => (
                        <button
                            key={s}
                            onClick={() => setFormData({...formData, status: s})}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border ${
                                formData.status === s 
                                ? `${themeColors.primary} text-white border-transparent shadow-md` 
                                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {/* Map status to localized text */}
                            {s === 'new' ? TEXTS.statusNew[language] : 
                             s === 'used' ? TEXTS.statusUsed[language] : 
                             s === 'broken' ? TEXTS.statusBroken[language] : 
                             TEXTS.statusSold[language]}
                        </button>
                    ))}
                 </div>
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
                    placeholder="https://..."
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

            <button 
              onClick={handleSubmit}
              className={`w-full py-4 mt-4 rounded-full font-bold text-white text-lg shadow-lg ${themeColors.primary}`}
            >
              {TEXTS.save[language]}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddItemModal;