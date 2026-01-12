import React from 'react';
import { Item, Language, ThemeColor } from '../types';
import { THEMES, ICONS, TEXTS, CATEGORY_CONFIG } from '../constants';

interface TimelineProps {
  items: Item[];
  theme: ThemeColor;
  language: Language;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onAddUsage: (item: Item) => void;
}

const getDaysOwned = (dateStr: string) => {
  const start = new Date(dateStr).getTime();
  const now = new Date().getTime();
  const diff = now - start;
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const getGroupTitle = (dateStr: string, language: Language) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    if (language === 'en') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
    return `${year}年${month}月`;
};

const Timeline: React.FC<TimelineProps> = ({ items, theme, language, onEdit, onAddUsage }) => {
  const themeColors = THEMES[theme];

  // Sort items by date descending
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }, [items]);

  // Group items by Month/Year
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, Item[]> = {};
    sortedItems.forEach(item => {
        const date = new Date(item.purchaseDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });
    return groups;
  }, [sortedItems]);

  const groupKeys = Object.keys(groupedItems).sort((a, b) => b.localeCompare(a)); // Newest months first

  if (sortedItems.length === 0) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center opacity-40 space-y-4">
        <ICONS.Tag size={48} />
        <p className="text-lg font-medium">No items yet</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-32 px-4 space-y-6 pt-2">
      {groupKeys.map(key => (
        <div key={key}>
            {/* Timeline Header */}
            <div className="flex items-center gap-3 mb-3 ml-2">
                <div className={`w-2 h-2 rounded-full ${themeColors.primary}`}></div>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    {getGroupTitle(`${key}-01`, language)}
                </h2>
            </div>

            <div className="space-y-3">
                {groupedItems[key].map(item => {
                    const days = getDaysOwned(item.purchaseDate);
                    const costPerDay = item.price / days;
                    const costPerUse = item.usageCount ? item.price / item.usageCount : item.price;
                    const catConfig = CATEGORY_CONFIG[item.category || 'other'];
                    const CatIcon = catConfig.icon;

                    return (
                        <div key={item.id} className="relative bg-white rounded-[1.5rem] p-4 shadow-sm border border-gray-100 overflow-hidden group">
                            <div className="flex gap-4 mb-3">
                                {/* Image Section */}
                                <div className="w-20 h-20 flex-shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 relative">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ICONS.ImageIcon size={24} />
                                        </div>
                                    )}
                                    {/* Category Badge */}
                                    <div className="absolute top-1 left-1 bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
                                        <CatIcon size={12} className={catConfig.color} />
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div className="flex-1 min-w-0 pr-8">
                                    <h3 className="font-bold text-gray-800 text-base truncate mb-1">{item.name}</h3>
                                    
                                    <div className="flex items-baseline gap-2">
                                        <span className={`font-mono font-bold text-lg ${themeColors.secondary}`}>
                                            ¥{item.price.toLocaleString()}
                                        </span>
                                        {item.msrp > item.price && (
                                            <span className="text-xs text-gray-400 line-through decoration-gray-300">
                                                ¥{item.msrp.toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <ICONS.Calendar size={10} />
                                            {item.purchaseDate}
                                        </span>
                                        {item.status !== 'new' && (
                                            <span className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-md capitalize">
                                                {item.status}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Edit Button */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(item);
                                    }} 
                                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-gray-600 transition-colors"
                                >
                                    <ICONS.Edit3 size={18} />
                                </button>
                            </div>

                            {/* Stats Footer (Only for owned items) */}
                            {item.type === 'owned' && (
                                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                    <div className="flex gap-4">
                                        <div className="flex flex-col">
                                            <span className="opacity-50 text-[10px] uppercase">{TEXTS.valPerDay[language]}</span>
                                            <span className="font-mono font-semibold">¥{costPerDay.toFixed(1)}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="opacity-50 text-[10px] uppercase">{TEXTS.valPerUse[language]}</span>
                                            <span className="font-mono font-semibold">¥{costPerUse.toFixed(1)}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 pl-3 pr-1">
                                        <div className="flex items-center gap-1">
                                            <ICONS.Activity size={12} className="text-gray-400"/>
                                            <span className="font-mono font-bold text-gray-700">{item.usageCount || 0}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddUsage(item);
                                            }}
                                            className={`px-2 py-1 rounded-md text-[10px] font-bold text-white shadow-sm transition-transform active:scale-95 ${themeColors.primary}`}
                                        >
                                            {TEXTS.addUsage[language]}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      ))}
    </div>
  );
};

export default Timeline;