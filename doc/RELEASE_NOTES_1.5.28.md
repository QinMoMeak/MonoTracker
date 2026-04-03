# Tracker 1.5.28

## 本次更新

### Material You 主题迁移继续收口
- 将设置页、快速开始、AI 设置、WebDAV 面板、时间线卡片、统计卡片、错误边界、表单弹窗中的残余旧灰阶颜色替换为 Material 3 语义 token。
- 统一使用 `surface / surfaceVariant / outline / error / onSurfaceVariant` 这一类语义色，减少 `gray/slate/rose` 直写造成的主题割裂。
- 新增危险操作按钮语义样式，用于删除等高风险操作，颜色会随当前主题 token 保持一致。

### Android 原生 Fallback 升级到 Material 3
- Android 原生主题从旧的 `AppCompat` 升级为 `Theme.Material3.DayNight.NoActionBar`，让 Android 12 以下设备也能使用更一致的 Material 3 基线外观。
- 新增原生颜色资源，补齐 `primary / secondary / surface / outline / error` 等关键角色色。
- 启动画面结束后会回到新的 Material 3 `NoActionBar` 主题，原生层和 React 层的主题风格更加统一。

### 动态配色体系更完整
- CSS 变量继续作为前端唯一主题来源，React 组件不再依赖固定的硬编码颜色值。
- 新增错误色 RGB 变量，支持删除按钮等语义场景用同一套动态配色机制渲染。
- Android 12 及以上继续优先读取系统 Material You 动态色；不支持动态色的平台回退到静态 Material 3 token。

## 验证
- 前端生产构建通过。
- Android Debug APK 构建通过。
- 当前版本为 `1.5.28`，`versionCode` 为 `47`。
