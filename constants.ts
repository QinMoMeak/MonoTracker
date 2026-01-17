
import { Translations, ThemeColor, Language, CategoryType } from './types';
import { 
  Home, 
  Heart, 
  User, 
  Plus, 
  Calendar, 
  DollarSign, 
  Tag, 
  Link as LinkIcon, 
  Image as ImageIcon,
  Sparkles,
  Download,
  Upload,
  Globe,
  Palette,
  Trash2,
  Edit3,
  Activity,
  Smartphone,
  Shirt,
  Armchair,
  BookOpen,
  Dumbbell,
  Box,
  PieChart,
  LayoutGrid,
  Moon,
  Sun,
  Monitor,
  HeartPulse,
  ShoppingBag,
  Database,
  X,
  BarChart2,
  Clock,
  Layers,
  TrendingUp,
  Share2,
  Copy,
  FileText
} from 'lucide-react';

export const ICONS = {
  Home, Heart, User, Plus, Calendar, DollarSign, Tag, LinkIcon, ImageIcon, Sparkles, Download, Upload, Globe, Palette, Trash2, Edit3, Activity,
  Smartphone, Shirt, Armchair, BookOpen, Dumbbell, Box, PieChart, LayoutGrid, Moon, Sun, Monitor, HeartPulse, ShoppingBag, Database, X,
  BarChart2, Clock, Layers, TrendingUp, Share2, Copy, FileText
};

// Config for known categories. Custom ones will fallback to 'other' visuals but keep their name.
export const CATEGORY_CONFIG: Record<string, { icon: any, labelKey: string, color: string, bg: string }> = {
  digital: { icon: Smartphone, labelKey: 'catDigital', color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  fashion: { icon: Shirt, labelKey: 'catFashion', color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  home: { icon: Armchair, labelKey: 'catHome', color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  beauty: { icon: Sparkles, labelKey: 'catBeauty', color: 'text-pink-500 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  books: { icon: BookOpen, labelKey: 'catBooks', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  sports: { icon: Dumbbell, labelKey: 'catSports', color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  health: { icon: HeartPulse, labelKey: 'catHealth', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  other: { icon: Box, labelKey: 'catOther', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
};

export const DEFAULT_CHANNELS = ['JD', 'Taobao', 'PDD', 'Xianyu', 'Douyin'];

export const THEMES: Record<ThemeColor, { primary: string; secondary: string; surface: string; onSurface: string; container: string }> = {
  blue: { 
    primary: 'bg-blue-600 dark:bg-blue-500', 
    secondary: 'text-blue-600 dark:text-blue-400', 
    surface: 'bg-blue-50 dark:bg-slate-950', 
    onSurface: 'text-blue-900 dark:text-blue-100', 
    container: 'bg-blue-100 dark:bg-blue-900/20' 
  },
  green: { 
    primary: 'bg-emerald-600 dark:bg-emerald-500', 
    secondary: 'text-emerald-600 dark:text-emerald-400', 
    surface: 'bg-emerald-50 dark:bg-slate-950', 
    onSurface: 'text-emerald-900 dark:text-emerald-100', 
    container: 'bg-emerald-100 dark:bg-emerald-900/20' 
  },
  violet: { 
    primary: 'bg-violet-600 dark:bg-violet-500', 
    secondary: 'text-violet-600 dark:text-violet-400', 
    surface: 'bg-violet-50 dark:bg-slate-950', 
    onSurface: 'text-violet-900 dark:text-violet-100', 
    container: 'bg-violet-100 dark:bg-violet-900/20' 
  },
  orange: { 
    primary: 'bg-orange-600 dark:bg-orange-500', 
    secondary: 'text-orange-600 dark:text-orange-400', 
    surface: 'bg-orange-50 dark:bg-slate-950', 
    onSurface: 'text-orange-900 dark:text-orange-100', 
    container: 'bg-orange-100 dark:bg-orange-900/20' 
  },
  rose: { 
    primary: 'bg-rose-600 dark:bg-rose-500', 
    secondary: 'text-rose-600 dark:text-rose-400', 
    surface: 'bg-rose-50 dark:bg-slate-950', 
    onSurface: 'text-rose-900 dark:text-rose-100', 
    container: 'bg-rose-100 dark:bg-rose-900/20' 
  },
};

export const TEXTS: Translations = {
  tabOwned: { 'zh-CN': '已购买', 'zh-TW': '已購買', 'en': 'Owned', 'ja': '購入済' },
  tabWishlist: { 'zh-CN': '心愿单', 'zh-TW': '心願單', 'en': 'Wishlist', 'ja': '欲しい物' },
  tabStats: { 'zh-CN': '统计', 'zh-TW': '統計', 'en': 'Stats', 'ja': '統計' },
  tabMine: { 'zh-CN': '我的', 'zh-TW': '我的', 'en': 'Mine', 'ja': 'マイページ' },
  addItem: { 'zh-CN': '添加物品', 'zh-TW': '添加物品', 'en': 'Add Item', 'ja': '追加' },
  editItem: { 'zh-CN': '编辑物品', 'zh-TW': '編輯物品', 'en': 'Edit Item', 'ja': '編集' },
  quickAdd: { 'zh-CN': 'AI 快速添加', 'zh-TW': 'AI 快速添加', 'en': 'AI Quick Add', 'ja': 'AI追加' },
  manualAdd: { 'zh-CN': '手动添加', 'zh-TW': '手動添加', 'en': 'Manual Add', 'ja': '手動追加' },
  showAiButton: { 'zh-CN': '显示 AI 按钮', 'zh-TW': '顯示 AI 按鈕', 'en': 'Show AI Button', 'ja': 'AIボタンを表示' },
  analyzeDesc: { 'zh-CN': '输入描述或上传图片，AI 将自动填写信息', 'zh-TW': '輸入描述或上傳圖片，AI 將自動填寫信息', 'en': 'Enter text or upload image, AI will fill details', 'ja': 'テキストや画像を解析して自動入力' },
  placeholderDesc: { 'zh-CN': '例如：昨天在京东买了索尼耳机，花了1200元...', 'zh-TW': '例如：昨天在京東買了索尼耳機，花了1200元...', 'en': 'E.g., Bought Sony headphones on Amazon yesterday for $200...', 'ja': '例：昨日Amazonでソニーのヘッドホンを2万円で買った...' },
  analyzing: { 'zh-CN': '分析中...', 'zh-TW': '分析中...', 'en': 'Analyzing...', 'ja': '解析中...' },
  save: { 'zh-CN': '保存', 'zh-TW': '保存', 'en': 'Save', 'ja': '保存' },
  cancel: { 'zh-CN': '取消', 'zh-TW': '取消', 'en': 'Cancel', 'ja': 'キャンセル' },
  name: { 'zh-CN': '名称', 'zh-TW': '名稱', 'en': 'Name', 'ja': '名前' },
  price: { 'zh-CN': '价格', 'zh-TW': '價格', 'en': 'Price', 'ja': '価格' },
  msrp: { 'zh-CN': '原价', 'zh-TW': '原價', 'en': 'MSRP', 'ja': '定価' },
  date: { 'zh-CN': '日期', 'zh-TW': '日期', 'en': 'Date', 'ja': '日付' },
  status: { 'zh-CN': '状态', 'zh-TW': '狀態', 'en': 'Status', 'ja': '状態' },
  category: { 'zh-CN': '分类', 'zh-TW': '分類', 'en': 'Category', 'ja': 'カテゴリ' },
  channel: { 'zh-CN': '购买渠道', 'zh-TW': '購買渠道', 'en': 'Channel', 'ja': '購入元' },
  note: { 'zh-CN': '备注', 'zh-TW': '備註', 'en': 'Note', 'ja': 'メモ' },
  link: { 'zh-CN': '链接', 'zh-TW': '鏈接', 'en': 'Link', 'ja': 'リンク' },
  import: { 'zh-CN': '导入数据', 'zh-TW': '導入數據', 'en': 'Import CSV', 'ja': 'CSVインポート' },
  export: { 'zh-CN': '导出数据', 'zh-TW': '導出數據', 'en': 'Export CSV', 'ja': 'CSVエクスポート' },
  theme: { 'zh-CN': '主题颜色', 'zh-TW': '主題顏色', 'en': 'Theme Color', 'ja': 'テーマ色' },
  language: { 'zh-CN': '语言', 'zh-TW': '語言', 'en': 'Language', 'ja': '言語' },
  totalValue: { 'zh-CN': '总价值', 'zh-TW': '總價值', 'en': 'Total Value', 'ja': '総資産' },
  itemCount: { 'zh-CN': '物品数量', 'zh-TW': '物品數量', 'en': 'Item Count', 'ja': 'アイテム数' },
  valPerDay: { 'zh-CN': '日均价值', 'zh-TW': '日均價值', 'en': 'Cost/Day', 'ja': '一日あたり' },
  valPerUse: { 'zh-CN': '次均价值', 'zh-TW': '次均價值', 'en': 'Cost/Use', 'ja': '一回あたり' },
  usage: { 'zh-CN': '使用次数', 'zh-TW': '使用次數', 'en': 'Usage', 'ja': '使用回数' },
  addUsage: { 'zh-CN': '+1次', 'zh-TW': '+1次', 'en': '+1 Use', 'ja': '+1回' },
  deleteConfirm: { 'zh-CN': '确定删除吗？', 'zh-TW': '確定刪除嗎？', 'en': 'Delete item?', 'ja': '削除しますか？' },
  filterAll: { 'zh-CN': '全部', 'zh-TW': '全部', 'en': 'All', 'ja': '全て' },
  
  // Stats New
  statsDuration: { 'zh-CN': '持有时长分布', 'zh-TW': '持有時長分佈', 'en': 'Duration Dist.', 'ja': '保有期間分布' },
  statsStatusDist: { 'zh-CN': '资产状态分布', 'zh-TW': '資產狀態分佈', 'en': 'Status Dist.', 'ja': '状態分布' },
  statsValDist: { 'zh-CN': '分类价值分布', 'zh-TW': '分類價值分佈', 'en': 'Value Dist.', 'ja': '価値分布' },
  statsCountDist: { 'zh-CN': '分类数量分布', 'zh-TW': '分類數量分佈', 'en': 'Count Dist.', 'ja': '数量分布' },
  statsTimeline: { 'zh-CN': '状态时间线', 'zh-TW': '狀態時間線', 'en': 'Status Timeline', 'ja': '状態タイムライン' },
  
  // Statuses
  statusNew: { 'zh-CN': '全新', 'zh-TW': '全新', 'en': 'New', 'ja': '新品' },
  statusUsed: { 'zh-CN': '二手', 'zh-TW': '二手', 'en': 'Used', 'ja': '中古' },
  statusBroken: { 'zh-CN': '损坏', 'zh-TW': '損壞', 'en': 'Broken', 'ja': '故障' },
  statusSold: { 'zh-CN': '已售', 'zh-TW': '已售', 'en': 'Sold', 'ja': '売却' },
  statusEmptied: { 'zh-CN': '用罄', 'zh-TW': '用罄', 'en': 'Emptied', 'ja': '使い切り' },
  
  // Channels
  chanJD: { 'zh-CN': '京东', 'zh-TW': '京東', 'en': 'JD', 'ja': 'JD' },
  chanTaobao: { 'zh-CN': '淘宝', 'zh-TW': '淘寶', 'en': 'Taobao', 'ja': 'タオバオ' },
  chanPDD: { 'zh-CN': '拼多多', 'zh-TW': '拼多多', 'en': 'Pinduoduo', 'ja': 'Pinduoduo' },
  chanXianyu: { 'zh-CN': '闲鱼', 'zh-TW': '閒魚', 'en': 'Xianyu', 'ja': 'Xianyu' },
  chanDouyin: { 'zh-CN': '抖音', 'zh-TW': '抖音', 'en': 'Douyin', 'ja': 'TikTok' },
  
  // Categories
  statsOverview: { 'zh-CN': '资产概览', 'zh-TW': '資產概覽', 'en': 'Overview', 'ja': '資産概要' },
  statsCategory: { 'zh-CN': '分类统计', 'zh-TW': '分類統計', 'en': 'By Category', 'ja': 'カテゴリ別' },
  catDigital: { 'zh-CN': '数码', 'zh-TW': '數碼', 'en': 'Digital', 'ja': 'デジタル' },
  catFashion: { 'zh-CN': '服饰', 'zh-TW': '服飾', 'en': 'Fashion', 'ja': '服飾' },
  catHome: { 'zh-CN': '家居', 'zh-TW': '家居', 'en': 'Home', 'ja': 'ホーム' },
  catBeauty: { 'zh-CN': '美妆', 'zh-TW': '美妝', 'en': 'Beauty', 'ja': '美容' },
  catBooks: { 'zh-CN': '书籍', 'zh-TW': '書籍', 'en': 'Books', 'ja': '書籍' },
  catSports: { 'zh-CN': '运动', 'zh-TW': '運動', 'en': 'Sports', 'ja': 'スポーツ' },
  catHealth: { 'zh-CN': '健康', 'zh-TW': '健康', 'en': 'Health', 'ja': '健康' },
  catOther: { 'zh-CN': '其他', 'zh-TW': '其他', 'en': 'Other', 'ja': 'その他' },
  
  appearance: { 'zh-CN': '外观模式', 'zh-TW': '外觀模式', 'en': 'Appearance', 'ja': '外観モード' },
  modeLight: { 'zh-CN': '浅色', 'zh-TW': '淺色', 'en': 'Light', 'ja': 'ライト' },
  modeDark: { 'zh-CN': '深色', 'zh-TW': '深色', 'en': 'Dark', 'ja': 'ダーク' },
  modeSystem: { 'zh-CN': '跟随系统', 'zh-TW': '跟隨系統', 'en': 'System', 'ja': 'システム' },
  custom: { 'zh-CN': '自定义', 'zh-TW': '自定義', 'en': 'Custom', 'ja': 'カスタム' },
  
  // Data Management
  manageData: { 'zh-CN': '数据管理', 'zh-TW': '數據管理', 'en': 'Manage Data', 'ja': 'データ管理' },
  manageCat: { 'zh-CN': '自定义分类', 'zh-TW': '自定義分類', 'en': 'Custom Categories', 'ja': 'カスタムカテゴリ' },
  manageChan: { 'zh-CN': '自定义渠道', 'zh-TW': '自定義渠道', 'en': 'Custom Channels', 'ja': 'カスタム購入元' },
  confirmDeleteTag: { 'zh-CN': '删除此标签？', 'zh-TW': '刪除此標籤？', 'en': 'Delete this tag?', 'ja': 'このタグを削除しますか？' },
  newCategoryPrompt: { 'zh-CN': '输入新分类名称', 'zh-TW': '輸入新分類名稱', 'en': 'New Category Name', 'ja': '新しいカテゴリ名' },
  newChannelPrompt: { 'zh-CN': '输入新渠道名称', 'zh-TW': '輸入新渠道名稱', 'en': 'New Channel Name', 'ja': '新しい購入元名' },
  
  // Export Modal Translations
  exportTitle: { 'zh-CN': '导出数据', 'zh-TW': '導出數據', 'en': 'Export Data', 'ja': 'データ出力' },
  exportDesc: { 
      'zh-CN': '请选择导出方式。如果直接保存无反应，请尝试复制内容。', 
      'zh-TW': '請選擇導出方式。如果直接保存無反應，請嘗試複製內容。', 
      'en': 'Select export method. If save fails, try copying.', 
      'ja': '出力方法を選択。保存できない場合はコピーしてください。' 
  },
  btnSaveFile: { 'zh-CN': '保存为文件 (推荐)', 'zh-TW': '保存為文件 (推薦)', 'en': 'Save to File', 'ja': 'ファイルに保存' },
  btnShareFile: { 'zh-CN': '分享文件', 'zh-TW': '分享文件', 'en': 'Share File', 'ja': 'ファイルを共有' },
  btnCopy: { 'zh-CN': '复制 CSV 内容', 'zh-TW': '複製 CSV 內容', 'en': 'Copy Content', 'ja': '内容をコピー' },
  copySuccess: { 'zh-CN': '已复制！', 'zh-TW': '已複製！', 'en': 'Copied!', 'ja': 'コピー完了' },
  exportSuccess: { 'zh-CN': '文件已成功导出！', 'zh-TW': '文件已成功導出！', 'en': 'Export successful!', 'ja': 'エクスポート成功！' },
  manualCopyTip: { 
      'zh-CN': '如果上方按钮都无效，请手动全选复制下方文字：', 
      'zh-TW': '如果上方按鈕都無效，請手動全選複製下方文字：', 
      'en': 'If buttons fail, manually copy the text below:', 
      'ja': 'ボタンが機能しない場合は、以下のテキストをコピーしてください：' 
  },
};

export const INITIAL_ITEMS = [];