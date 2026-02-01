# RELEASE_NOTES_1.4.0

## 1.3.0 之后的修改汇总

### 版本与包名
- 包名更新为 `com.Tracker.app`
- Android 版本号更新为 1.4.0（versionCode 4）
- Capacitor `appId` 与 Android `namespace/applicationId` 对齐为 `com.Tracker.app`
- 主 Activity 包路径同步为 `com.Tracker.app`

### AI 能力与模型支持
- AI 服务商选择合并为统一入口，支持禁用选项
- 模型选择改为下拉列表（不可编辑）
- 各服务商模型的 API Key/Base URL 独立保存，切换模型不再互相覆盖
- Z.ai（原智谱）适配 `glm-4.6v-flash`，Base URL 为 `https://open.bigmodel.cn/api/paas/v4/chat/completions`
- DeepSeek 新增 `deepseek-v3-2-251201`（Ark `/v3/chat/completions`）
- 豆包新增 `doubao-seed-1-8-251228`（Ark `/v3/chat/completions`）
- AI 服务商列表移除 Moonshot
- AI 识别支持同一物品多图联合分析
- Prompt 优化：强约束 JSON 字段，备注支持当前语言并更可复用

### 物品数据结构与展示
- 新增字段：店铺名称（storeName）
- 新增字段：数量（默认 1）与均价（price / quantity，保留 2 位）
- 当数量为 1 时，列表不显示“数量/均价”
- 物品价值展示改为可选（日均价值 / 次均价值互斥显示）
- 已购买与心愿单之间支持互相切换（在编辑页完成）

### 心愿单与统计增强
- 心愿单支持历史价格走势记录与展示
- 心愿单界面移除“总价值”统计

### 数据管理与多语言
- 分类/状态/来源统一在“数据管理”中增删改
- 语言文案改为内置多语言文本，修复非英语乱码显示

### 体验与交互
- AI 设置、数据管理改为二级弹窗
- 已购买与心愿单物品图片支持点击放大查看

## 说明
- 该文档为历史对话已实现内容的归纳整理，可作为 1.3.0 → 1.4.0 的更新参考
