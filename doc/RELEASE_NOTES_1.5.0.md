# RELEASE_NOTES_1.5.0

## 1.4.0 之后的修改汇总

### 版本与构建
- Android 版本号更新为 1.5.0（versionCode 19）
- JDK 21 纳入项目并统一 Android 子模块 Java 目标版本为 21，提升构建一致性

### WebDAV 备份与恢复
- 自动备份改为“每日首次打开”触发，避免重复上传
- 备份结构升级为 manifest history 列表：恢复最多展示 3 条、云端保留 4 条并自动清理旧包
- 备份根目录改为 `TrackerBackups/`（包含 snapshots / staging / manifest.json）
- 增加 `.ready` 标记与 size/sha256 元数据，防止不完整备份被恢复
- 新增“包含图片”开关（默认关闭），可显著减少上传体积

### 统计与趋势图
- 统计趋势图改为 ECharts 渲染，开启 smooth + 单调插值，提升曲线观感
- Y 轴加入数据范围 padding，避免数值挤在顶部
- 趋势曲线加入视觉平滑与数值压缩处理，改善极端值比例观感

### 性能与稳定性
- 趋势曲线复用 ECharts 实例，避免反复 init/dispose
- 图表数据提前 memo 化，减少无效渲染
- 通过 lint/tsc 清理未使用导入与死代码

## 说明
- 该文档为 1.4.0 → 1.5.0 的更新归纳，可作为发版说明
