import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts/core';
import type { ECharts } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Item, Language } from '../types';

echarts.use([LineChart, GridComponent, CanvasRenderer]);

const chartHeightPx = 128;
const durationLabels = ['<1M', '1-6M', '6-12M', '1-3Y', '>3Y'];

const compressValue = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0;
  const clamped = Math.max(0, safe);
  return Math.log10(clamped + 1);
};

const smoothVisualValues = (values: number[], tension = 0.22) => {
  if (values.length <= 2) return values.slice();
  const nextValues = values.slice();
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const current = values[i];
    const next = values[i + 1];
    const isBetween = (current - prev) * (current - next) <= 0;
    if (!isBetween) {
      nextValues[i] = current;
      continue;
    }
    const target = (prev + next) / 2;
    const blended = current * (1 - tension) + target * tension;
    const min = Math.min(prev, next);
    const max = Math.max(prev, next);
    nextValues[i] = Math.min(max, Math.max(min, blended));
  }
  return nextValues;
};

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
  CATEGORY_CONFIG: Record<string, { icon: React.ElementType; bg: string; color: string; labelKey: string }>;
  themeColors: { primary: string; secondary: string; container: string };
  currencySymbol: string;
  formatNumber: (value: number, decimals?: number) => string;
  toNumber: (value: unknown) => number;
  getStatusLabel: (status: string) => string;
  getCategoryLabel: (category: string) => string;
  getChannelLabel: (channel: string) => string;
  topN: number;
  onTopNChange: (count: number) => void;
};

const TrendLineChart: React.FC<{
  labels: string[];
  values: number[];
  height: number;
  themeColorClass: string;
}> = ({ labels, values, height, themeColorClass }) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const visualValues = useMemo(() => {
    const safeValues = values.map(value => (Number.isFinite(value) ? value : 0));
    const compressedValues = safeValues.map(compressValue);
    return smoothVisualValues(compressedValues, 0.22);
  }, [values]);

  const handleResize = useCallback(() => {
    instanceRef.current?.resize();
  }, []);

  useEffect(() => {
    if (!chartRef.current || instanceRef.current) return;
    const instance = echarts.init(chartRef.current, undefined, { renderer: 'canvas' });
    instanceRef.current = instance;
    const observer = new ResizeObserver(() => instanceRef.current?.resize());
    observer.observe(chartRef.current);
    resizeObserverRef.current = observer;
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [handleResize]);

  useEffect(() => {
    if (!chartRef.current || !instanceRef.current) return;
    const computedColor = window.getComputedStyle(chartRef.current).color;
    const option = {
      animation: true,
      grid: { left: 6, right: 6, top: 6, bottom: 0, containLabel: false },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        min: (value: { min: number; max: number }) => {
          const range = value.max - value.min;
          return Math.max(0, value.min - range * 0.25);
        },
        max: (value: { min: number; max: number }) => value.max * 1.05,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false }
      },
      series: [
        {
          type: 'line',
          data: visualValues,
          smooth: 0.6,
          smoothMonotone: 'x',
          cubicInterpolationMode: 'monotone',
          symbol: 'none',
          showSymbol: false,
          lineStyle: {
            width: 3,
            color: computedColor,
            cap: 'round',
            join: 'round'
          },
          itemStyle: { color: computedColor },
          areaStyle: { color: computedColor, opacity: 0.12 }
        }
      ]
    };
    instanceRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
    instanceRef.current.resize();
  }, [labels, visualValues, themeColorClass, height]);

  return <div ref={chartRef} className={`w-full ${themeColorClass}`} style={{ height: `${height}px` }} />;
};

const StatsTab: React.FC<StatsTabProps> = ({
  stats,
  language,
  TEXTS,
  ICONS,
  CATEGORY_CONFIG,
  themeColors,
  currencySymbol,
  formatNumber,
  toNumber,
  getStatusLabel,
  getCategoryLabel,
  getChannelLabel,
  topN,
  onTopNChange
}) => {
  const monthlySpendTotal = useMemo(
    () => stats.monthlySpend.reduce((acc, curr) => acc + (Number.isFinite(curr.value) ? curr.value : 0), 0),
    [stats.monthlySpend]
  );

  const monthlyTrendLabels = useMemo(
    () => stats.monthlySpend.map(item => item.month),
    [stats.monthlySpend]
  );

  const monthlyTrendValues = useMemo(
    () => stats.monthlySpend.map(item => toNumber(item.value)),
    [stats.monthlySpend, toNumber]
  );

  const durationValues = useMemo(
    () => durationLabels.map(label => toNumber((stats.durationBuckets as Record<string, number>)[label] ?? 0)),
    [stats.durationBuckets, toNumber]
  );

  const durationTotal = useMemo(
    () => durationValues.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0),
    [durationValues]
  );

  return (
    <div className="p-6 space-y-6 pb-32">
      {/* 1. Overview */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold opacity-80 flex items-center gap-2">
          <ICONS.PieChart size={20}/> {TEXTS.statsOverview[language]}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm transition-colors">
            <p className="text-xs opacity-50 uppercase font-bold mb-1">{TEXTS.totalValue[language]}</p>
            <p className={`text-2xl font-light ${themeColors.secondary}`}>{currencySymbol}{formatNumber(stats.totalVal)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm transition-colors">
            <p className="text-xs opacity-50 uppercase font-bold mb-1">{TEXTS.itemCount[language]}</p>
            <p className="text-2xl font-light text-gray-800 dark:text-gray-100">{stats.totalCount}</p>
          </div>
        </div>
      </div>

      {/* 1.5 Monthly Spend Trend */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.BarChart2 size={16}/> {TEXTS.statsMonthlyTrend[language]}
        </h3>
        <div className="space-y-3">
          {monthlySpendTotal <= 0 && (
            <p className="text-xs opacity-40">{TEXTS.noData[language]}</p>
          )}
          {monthlySpendTotal > 0 && stats.monthlySpend.length > 0 && (
            <>
              <TrendLineChart
                labels={monthlyTrendLabels}
                values={monthlyTrendValues}
                height={chartHeightPx}
                themeColorClass={themeColors.secondary}
              />
              <div
                className="grid gap-1 text-center"
                style={{ gridTemplateColumns: `repeat(${stats.monthlySpend.length}, minmax(0, 1fr))` }}
              >
                {stats.monthlySpend.map(({ month, value }) => (
                  <div key={month} className="text-[10px] text-gray-400 font-medium">
                    <div className="text-[10px] text-gray-500 dark:text-gray-300">
                      {currencySymbol}{formatNumber(toNumber(value), 0)}
                    </div>
                    <div className="mt-1">{month}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {monthlySpendTotal > 0 && stats.monthlySpend.length === 0 && (
            <p className="text-xs opacity-40">{TEXTS.none[language]}</p>
          )}
        </div>
      </div>

      {/* 2. Status Distribution */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.Layers size={16}/> {TEXTS.statsStatusDist[language]}
        </h3>
        <div className="space-y-3">
          {stats.statusStats.map(stat => (
            <div key={stat.status}>
              <div className="flex justify-between text-sm mb-1">
                <span className="capitalize font-medium">{getStatusLabel(stat.status)}</span>
                <span className="opacity-60">{stat.count} ({stat.percent.toFixed(1)}%)</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${themeColors.primary}`} style={{ width: `${stat.percent}%`, opacity: 0.7 }}></div>
              </div>
            </div>
          ))}
          {stats.statusStats.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.noData[language]}</p>}
        </div>
      </div>

      {/* 3. Duration Distribution */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.Clock size={16}/> {TEXTS.statsDuration[language]}
        </h3>
        <div className="space-y-3">
          {durationTotal <= 0 && (
            <p className="text-xs opacity-40">{TEXTS.noData[language]}</p>
          )}
          {durationTotal > 0 && (
            <>
              <TrendLineChart
                labels={durationLabels}
                values={durationValues}
                height={chartHeightPx}
                themeColorClass={themeColors.secondary}
              />
              <div
                className="grid gap-1 text-center"
                style={{ gridTemplateColumns: `repeat(${durationLabels.length}, minmax(0, 1fr))` }}
              >
                {durationLabels.map(label => {
                  const value = toNumber((stats.durationBuckets as Record<string, number>)[label] ?? 0);
                  return (
                    <div key={label} className="text-[10px] text-gray-400 font-medium">
                      <div className="text-[10px] text-gray-500 dark:text-gray-300">
                        {formatNumber(value, 0)}
                      </div>
                      <div className="mt-1">{label}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Category Spend Trend (Top N) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold opacity-70 flex items-center gap-2">
            <ICONS.BarChart2 size={16}/> {TEXTS.statsCategoryTrend[language]}
          </h3>
          <div className="flex gap-2">
            {[3, 5, 10].map(count => (
              <button
                key={count}
                onClick={() => onTopNChange(count)}
                className={`px-2 py-1 text-[10px] font-bold rounded-full transition-all ${
                  topN === count
                    ? `${themeColors.primary} text-white`
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
                }`}
              >
                TOP {count}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {stats.catStatsByValue.slice(0, topN).map((stat) => {
            const conf = CATEGORY_CONFIG[stat.cat] || CATEGORY_CONFIG['other'];
            const Icon = conf.icon;
            return (
              <div key={stat.cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${conf.bg}`}>
                      <Icon size={12} className={conf.color} />
                    </div>
                    <span className="text-sm font-medium">{getCategoryLabel(stat.cat)}</span>
                  </div>
                  <span className="text-sm font-bold">{currencySymbol}{formatNumber(stat.value)}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${conf.color.replace(/text-(\w+)-(\d+)/, 'bg-$1-$2')}`}
                    style={{ width: `${stat.percentVal}%` }}
                  />
                </div>
              </div>
            );
          })}
          {stats.catStatsByValue.length === 0 && <p className="text-center text-xs opacity-40">{TEXTS.none[language]}</p>}
        </div>
      </div>

      {/* 4.5 Channel Spend Trend */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.BarChart2 size={16}/> {TEXTS.statsChannelTrend[language]}
        </h3>
        <div className="space-y-4">
          {stats.channelStats.map((stat) => (
            <div key={stat.channel}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{getChannelLabel(stat.channel)}</span>
                <span className="text-sm font-bold">{currencySymbol}{formatNumber(stat.value)}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
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

      {/* 5. Category Count Distribution */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.BarChart2 size={16}/> {TEXTS.statsCountDist[language]}
        </h3>
        <div className="space-y-4">
          {stats.catStatsByCount.slice(0, 6).map((stat) => {
            const conf = CATEGORY_CONFIG[stat.cat] || CATEGORY_CONFIG['other'];
            const Icon = conf.icon;
            return (
              <div key={stat.cat}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${conf.bg}`}>
                      <Icon size={12} className={conf.color} />
                    </div>
                    <span className="text-sm font-medium">{getCategoryLabel(stat.cat)}</span>
                  </div>
                  <span className="text-sm font-bold">{stat.count}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${conf.color.replace(/text-(\w+)-(\d+)/, 'bg-$1-$2')}`}
                    style={{ width: `${stat.percentCount}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Status Timeline */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm transition-colors">
        <h3 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
          <ICONS.TrendingUp size={16}/> {TEXTS.statsTimeline[language]}
        </h3>
        <div className="space-y-0 relative border-l-2 border-gray-100 dark:border-slate-800 ml-2">
          {stats.timelineData.slice(0, 10).map((item) => (
            <div key={item.id} className="mb-6 ml-4 relative">
              <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${themeColors.primary}`}></div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-400 font-mono mb-0.5">{item.purchaseDate}</p>
                  <p className="text-sm font-bold">{item.name}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 font-medium capitalize">
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
