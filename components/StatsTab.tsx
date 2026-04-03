import React, { useMemo } from 'react';
import { Item, Language } from '../types';
import { formatDate, formatMonth } from '../utils/date';
import { formatCurrency } from '../utils/format';
import { getCategoryBadgeStyle, getCategoryBarStyle, getCategoryIconStyle } from '../utils/categoryTheme';

type StatsData = {
  totalVal: number;
  totalCount: number;
  monthlySpend: { month: string; value: number }[];
  statusStats: { status: string; count: number; percent: number }[];
  durationBuckets: Record<string, number>;
  catStatsByValue: { cat: string; value: number; percentVal: number }[];
  catStatsByCount: { cat: string; count: number; percentCount: number }[];
  channelStats: { channel: string; value: number; percentVal: number }[];
  timelineData: Item[];
};

type StatsTabProps = {
  stats: StatsData;
  language: Language;
  TEXTS: Record<string, Record<string, string>>;
  ICONS: Record<string, React.ElementType>;
  CATEGORY_CONFIG: Record<string, { icon: React.ElementType; accent: string; labelKey: string }>;
  themeColors: { primary: string; secondary: string; container: string };
  formatNumber: (value: number, decimals?: number) => string;
  toNumber: (value: unknown) => number;
  getStatusLabel: (status: string) => string;
  getCategoryLabel: (category: string) => string;
  getChannelLabel: (channel: string) => string;
  topN: number;
  onTopNChange: (count: number) => void;
};

const durationLabels = ['<1M', '1-6M', '6-12M', '1-3Y', '>3Y'];

const StatsTab: React.FC<StatsTabProps> = ({
  stats,
  language,
  TEXTS,
  ICONS,
  CATEGORY_CONFIG,
  themeColors,
  formatNumber,
  toNumber,
  getStatusLabel,
  getCategoryLabel,
  getChannelLabel,
  topN,
  onTopNChange
}) => {
  const monthlySpendRows = useMemo(
    () => stats.monthlySpend.map(item => ({ month: formatMonth(item.month), value: toNumber(item.value) })),
    [stats.monthlySpend, toNumber]
  );

  const monthlyMaxValue = useMemo(
    () => monthlySpendRows.reduce((max, row) => Math.max(max, row.value), 0),
    [monthlySpendRows]
  );

  const durationTotal = useMemo(
    () => durationLabels.reduce((sum, label) => sum + toNumber(stats.durationBuckets[label] ?? 0), 0),
    [stats.durationBuckets, toNumber]
  );

  return (
    <div className="p-6 space-y-6 pb-32">
      <div className="space-y-4">
        <h2 className="text-lg font-bold opacity-80 flex items-center gap-2">
          <ICONS.PieChart size={20} /> {TEXTS.statsOverview[language]}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="app-surface-card p-5 rounded-[2rem] shadow-sm transition-colors">
            <p className="text-xs opacity-50 uppercase font-bold mb-1">{TEXTS.totalValue[language]}</p>
            <p className={`text-2xl font-light ${themeColors.secondary}`}>{formatCurrency(stats.totalVal, 'CNY', language)}</p>
          </div>
          <div className="app-surface-card p-5 rounded-[2rem] shadow-sm transition-colors">
            <p className="text-xs opacity-50 uppercase font-bold mb-1">{TEXTS.itemCount[language]}</p>
            <p className="text-2xl font-light">{stats.totalCount}</p>
          </div>
        </div>
      </div>

      <div className="app-surface-card p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.BarChart2 size={16} /> {TEXTS.statsMonthlyTrend[language]}
        </h3>
        <div className="space-y-3">
          {monthlySpendRows.length === 0 && (
            <p className="text-xs opacity-40">{TEXTS.noData[language]}</p>
          )}
          {monthlySpendRows.map(({ month, value }) => {
            const width = monthlyMaxValue > 0 ? Math.max(8, (value / monthlyMaxValue) * 100) : 0;
            return (
              <div key={month} className="rounded-2xl app-surface-soft px-4 py-3">
                <div className="flex items-center justify-between text-sm mb-2 gap-4">
                  <span className="font-semibold">{month}</span>
                  <span className={`font-mono font-semibold ${themeColors.secondary}`}>{formatCurrency(value, 'CNY', language, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="h-2 rounded-full app-progress-track overflow-hidden">
                  <div className={`h-full rounded-full ${themeColors.primary}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="app-surface-card p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.Layers size={16} /> {TEXTS.statsStatusDist[language]}
        </h3>
        <div className="space-y-3">
          {stats.statusStats.map(stat => (
            <div key={stat.status}>
              <div className="flex justify-between text-sm mb-1">
                <span className="capitalize font-medium">{getStatusLabel(stat.status)}</span>
                <span className="opacity-60">{stat.count} ({stat.percent.toFixed(1)}%)</span>
              </div>
              <div className="h-2 app-progress-track rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${themeColors.primary}`} style={{ width: `${stat.percent}%`, opacity: 0.7 }} />
              </div>
            </div>
          ))}
          {stats.statusStats.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.noData[language]}</p>}
        </div>
      </div>

      <div className="app-surface-card p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.Clock size={16} /> {TEXTS.statsDuration[language]}
        </h3>
        <div className="space-y-3">
          {durationTotal <= 0 && (
            <p className="text-xs opacity-40">{TEXTS.noData[language]}</p>
          )}
          {durationTotal > 0 && durationLabels.map(label => {
            const value = toNumber(stats.durationBuckets[label] ?? 0);
            const width = durationTotal > 0 ? (value / durationTotal) * 100 : 0;
            return (
              <div key={label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{label}</span>
                  <span className="opacity-60">{formatNumber(value, 0)}</span>
                </div>
                <div className="h-2 app-progress-track rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${themeColors.primary}`} style={{ width: `${width}%`, opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="app-surface-card p-6 rounded-[2rem] shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold opacity-70 flex items-center gap-2">
            <ICONS.BarChart2 size={16} /> {TEXTS.statsCategoryTrend[language]}
          </h3>
          <div className="flex gap-2">
            {[3, 5, 10].map(count => (
              <button
                key={count}
                onClick={() => onTopNChange(count)}
                className={`px-2 py-1 text-[10px] font-bold rounded-full transition-all ${
                  topN === count
                    ? `${themeColors.primary} text-white`
                    : 'app-chip'
                }`}
              >
                TOP {count}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {stats.catStatsByValue.slice(0, topN).map(stat => {
            const conf = CATEGORY_CONFIG[stat.cat] || CATEGORY_CONFIG.other;
            const Icon = conf.icon;
            return (
              <div key={stat.cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md" style={getCategoryBadgeStyle(conf)}>
                      <Icon size={12} style={getCategoryIconStyle(conf)} />
                    </div>
                    <span className="text-sm font-medium">{getCategoryLabel(stat.cat)}</span>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(stat.value, 'CNY', language)}</span>
                </div>
                <div className="h-1.5 w-full app-progress-track rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ ...getCategoryBarStyle(conf), width: `${stat.percentVal}%` }}
                  />
                </div>
              </div>
            );
          })}
          {stats.catStatsByValue.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.none[language]}</p>}
        </div>
      </div>

      <div className="app-surface-card p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.BarChart2 size={16} /> {TEXTS.statsChannelTrend[language]}
        </h3>
        <div className="space-y-4">
          {stats.channelStats.map(stat => (
            <div key={stat.channel}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{getChannelLabel(stat.channel)}</span>
                <span className="text-sm font-bold">{formatCurrency(stat.value, 'CNY', language)}</span>
              </div>
              <div className="h-1.5 w-full app-progress-track rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${themeColors.primary}`}
                  style={{ width: `${stat.percentVal}%`, opacity: 0.7 }}
                />
              </div>
            </div>
          ))}
          {stats.channelStats.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.none[language]}</p>}
        </div>
      </div>

      <div className="app-surface-card p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.BarChart2 size={16} /> {TEXTS.statsCountDist[language]}
        </h3>
        <div className="space-y-4">
          {stats.catStatsByCount.slice(0, 6).map(stat => {
            const conf = CATEGORY_CONFIG[stat.cat] || CATEGORY_CONFIG.other;
            const Icon = conf.icon;
            return (
              <div key={stat.cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md" style={getCategoryBadgeStyle(conf)}>
                      <Icon size={12} style={getCategoryIconStyle(conf)} />
                    </div>
                    <span className="text-sm font-medium">{getCategoryLabel(stat.cat)}</span>
                  </div>
                  <span className="text-sm font-bold">{stat.count}</span>
                </div>
                <div className="h-1.5 w-full app-progress-track rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ ...getCategoryBarStyle(conf), width: `${stat.percentCount}%` }}
                  />
                </div>
              </div>
            );
          })}
          {stats.catStatsByCount.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.none[language]}</p>}
        </div>
      </div>

      <div className="app-surface-card p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.TrendingUp size={16} /> {TEXTS.statsTimeline[language]}
        </h3>
        <div className="space-y-0 relative border-l-2 app-timeline-line ml-2">
          {stats.timelineData.slice(0, 10).map(item => (
            <div key={item.id} className="mb-6 ml-4 relative">
              <div
                className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 ${themeColors.primary}`}
                style={{ borderColor: 'var(--app-card)' }}
              />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs app-text-muted font-mono mb-0.5">{formatDate(item.purchaseDate)}</p>
                  <p className="text-sm font-bold">{item.name}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded app-chip font-medium capitalize">
                  {getStatusLabel(item.status)}
                </span>
              </div>
            </div>
          ))}
          {stats.timelineData.length === 0 && <p className="ml-4 text-xs opacity-40">{TEXTS.noActivity[language]}</p>}
        </div>
      </div>
    </div>
  );
};

export default StatsTab;
