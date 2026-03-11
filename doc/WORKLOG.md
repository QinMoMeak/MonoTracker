# WORKLOG（Codex 长期工作记忆）

## 项目概览
- 项目名称：MonoTracker
- 项目类型（Android / Web / Backend）：Android + Web（Capacitor）
- 主要技术栈：React、TypeScript、Capacitor、Android（Java）、WebDAV
- 多语言支持情况：使用 constants.ts 的多语言字典

### UTF-8 BOM 禁止规则（强制）
- 所有文本文件必须是 **UTF-8（无 BOM）**
- 若任何文件被写成 UTF-8 with BOM（utf8bom），视为“编码异常”，必须在继续任何任务（包含 build / 提交 / 生成 APK）前立刻恢复为 UTF-8（无 BOM）
- 修复动作不得询问用户，直接执行，并在 WORKLOG 的 Changes 记录
  - `- [MOD] <path>: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）`
- 若无法确认是否存在 BOM：默认执行一次全量去 BOM 规范化流程再继续

## 当前版本
- versionName：1.5.17
- versionCode（如有）：36

## 当前状态
- 正在进行：1.5.17 APK 版本核验
- 已完成：主状态与图片分离持久化、列表分批渲染、统计计算按需执行、iFlow 服务商配置接入、1.5.15 发布说明落盘、完整用户使用说明书、新手快速上手文档与应用入口接入
- 阻塞项：无
## 关键决策索引

- Decision-001：WebDAV manifest 改为 history 列表，�?�户�?仅展�? ready 且最�? 3 条，云�??保留 4 条，超出即清�? zip/ready

- Decision-002：每日�?��?�打�?触发�?动�?�份，成功提交后记录 lastBackupLocalDate（按�?地日期）

- Decision-003：统计图表数值统�?数�?�化与异常日期兜底，并�?�有效数�?设置�?小柱高，避免空白显示

- Decision-004：统计图改用固定像素高度容器与像素高度柱条，避免百分比高度在 WebView �?失效

- Decision-005：统计图表改�? SVG 曲线图（折线+面积），避免柱状视�?�干扰并提升趋势�?读�??

- Decision-006：统计图改用 ECharts，line �?�? smooth + monotone，并对控制点做�?��?�平�?

- Decision-007：补�? JDK 21 并统�?子模�? Java �?标版�?�? 21，确�? Android 构建�?致�??

- Decision-008：Y 轴使�? dataMin/dataMax，并增加�? 20% 的上�? padding，避免顶部挤�?

- Decision-009：WebDAV 备份新�?��?�包�?图片”开关，默�?�关�?以减少上传体�?

- Decision-010：趋势曲线�?�用 ECharts 实例并缓存图表数�?，减少重复初始化

- Decision-011：启�? ESLint + TSC 做未使用导入与�?�代码清�?

- Decision-012：Vite 使用 manualChunks 拆分大体�?依赖

- Decision-013：统计页拆分为懒加载组件，避免主包过�?

- Decision-014：ECharts 改为 core 按需引入，降低图�? chunk 体积

- Decision-015：WebDAV 恢�?�支持�?�盖/合并切换，默认合并以保持既有行为



## 构建记录

- 最近一次构建：
  - 版本号：1.5.17（versionCode 36）
  - APK 路径：android/app/build/outputs/apk/debug/app-debug.apk
  - 构建状态：成功

## 会话日志（按时间追加）
- 2026-02-01
  - 本轮上下文：界面切换明显卡顿，进行统计页与时间线渲染优化，并修复 WORKLOG 编码后完成构建
  - 关键决策：
    - 仅在持有/心愿列表页计算筛选与列表渲染，避免非列表 Tab 的无效计算
    - 时间线分组与派生字段在 useMemo 中一次性预计算，图片开启懒加载减少首屏压力
  - Changes：
    - [MOD] App.tsx: 列表页计算与渲染按 Tab 进行短路，减少无效开销
    - [MOD] components/Timeline.tsx: 分组与字段预计算，图片添加 lazy/async 解码
    - [MOD] package.json: 版本号提升至 1.5.11
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.11 / 30
    - [MOD] doc/WORKLOG.md: 修复编码并更新记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：WORKLOG 会话日志因编码异常已重建，本次记录从此条开始
  - Assumption：卡顿主要来自统计页与时间线渲染的重复计算与图片加载
  - 下一步 TODO：在真机上验证切换流畅度与统计页渲染稳定性

- 2026-03-10
  - 本轮上下文：添加多个物品后仍然卡顿，启动耗时过长，且总价值较高时新增物品会闪退，针对持久化与大列表渲染进行修复
  - 关键决策：
    - 将图片从主状态 JSON 中拆出，元数据与图片分离存储，启动先加载轻量数据，图片按需读取
    - 列表改为分批渲染，统计计算仅在进入统计页时执行，减少新增物品时的主线程压力
  - Changes：
    - [MOD] services/storageService.ts: 主状态与图片分离持久化，新增按需读取图片能力并兼容旧数据迁移
    - [MOD] services/backupService.ts: 导出备份时按需解析分离存储的图片
    - [MOD] App.tsx: 引入图片缓存与延迟保存，编辑/预览时按需加载图片，统计计算仅在统计页执行
    - [MOD] components/Timeline.tsx: 时间线改为分批渲染并在进入视口后再请求图片
    - [MOD] types.ts: 为物品增加 hasImage 标记
    - [MOD] package.json: 版本号提升至 1.5.12
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.12 / 31
    - [MOD] doc/WORKLOG.md: 更新工作记忆与构建记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：闪退主要由大体积状态同步写入与大量图片/base64 导致的内存和 I/O 峰值触发
  - 下一步 TODO：在真机上重点验证首屏加载时间、连续新增物品稳定性以及旧数据迁移后的图片显示

- 2026-03-10
  - 本轮上下文：参考 doc/iflow.md，在 AI 选项中新增 iFlow 服务商并完成构建
  - 关键决策：
    - iFlow 按 OpenAI 兼容服务商接入，默认 Base URL 使用 https://apis.iflow.cn/v1
    - 默认模型使用支持视觉识别的 Qwen3-VL-Plus，保证图片识别场景可直接使用
    - 当前机器仅有 JDK 17，Android 构建脚本统一回落到 Java 17 以恢复 debug APK 构建链路
  - Changes：
    - [MOD] types.ts: AiProvider 联合类型增加 iflow
    - [MOD] services/aiProviders.ts: 新增 iFlow 服务商元数据、默认模型与模型列表
    - [MOD] constants.ts: 新增 iFlow 服务商多语言文案
    - [MOD] package.json: 版本号提升至 1.5.13
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.13 / 32
    - [MOD] android/build.gradle: Android 子模块编译目标统一回落到 Java 17
    - [MOD] android/app/capacitor.build.gradle: 生成的 Capacitor 编译目标回落到 Java 17
    - [MOD] android/capacitor-cordova-android-plugins/build.gradle: Cordova 插件编译目标回落到 Java 17
    - [MOD] node_modules/@capacitor/android/capacitor/build.gradle: Capacitor Android 库编译目标回落到 Java 17
    - [MOD] node_modules/@capacitor/app/android/build.gradle: Capacitor App 插件编译目标回落到 Java 17
    - [MOD] node_modules/@capacitor/filesystem/android/build.gradle: Filesystem 插件编译目标与 Kotlin 工具链回落到 Java 17
    - [MOD] node_modules/@capacitor/share/android/build.gradle: Share 插件编译目标回落到 Java 17
    - [MOD] node_modules/@capacitor/splash-screen/android/build.gradle: Splash Screen 插件编译目标回落到 Java 17
    - [MOD] doc/WORKLOG.md: 更新工作记忆与构建记录
  - 多语言改动说明：新增 AI 服务商 iFlow 的 zh-CN / zh-TW / en / ja 文案
  - 构建结果：`npm run build`、`npx cap sync android`、`android\\gradlew assembleDebug` 全部成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：iFlow 文档中的 OpenAI Base URL 与模型列表可直接用于现有 OpenAI 兼容调用链路
  - 下一步 TODO：验证 iFlow 在文本识别与图片识别场景下的接口兼容性，并评估后续是否恢复到 JDK 21 构建环境

- 2026-03-10
  - 本轮上下文：AI 服务商过多导致列表末尾项目不易显示，调整 AI 设置弹窗布局以确保 iFlow 可见
  - 关键决策：
    - 服务商区域改为独立滚动容器，并压缩为三列紧凑按钮，避免末尾选项被弹窗高度吞掉
    - 增加滚动提示文案，降低用户误判为“服务商不存在”的概率
  - Changes：
    - [MOD] App.tsx: AI 服务商列表改为三列紧凑布局并启用独立滚动区域
    - [MOD] constants.ts: 新增 AI 服务商列表滚动提示文案（多语言）
    - [MOD] package.json: 版本号提升至 1.5.14
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.14 / 33
    - [MOD] doc/WORKLOG.md: 更新工作记忆与构建记录
  - 多语言改动说明：新增 AI 服务商滚动提示文案，已覆盖 zh-CN / zh-TW / en / ja
  - 构建结果：`npm run build`、`npx cap sync android`、`android\\gradlew assembleDebug` 全部成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：问题根因是弹窗内服务商列表长度超过首屏高度，用户未继续滚动
  - 下一步 TODO：确认 iFlow 在 AI 设置页中可见且可被选中

- 2026-03-10
  - 本轮上下文：整理 1.5.14 更新说明并保存到 doc 目录，供 release 使用
  - 关键决策：
    - 发布说明聚焦 iFlow 接入与 AI 设置页可见性修复，避免混入无关历史变更
    - 文档命名沿用现有 `RELEASE_NOTES_x.y.z.md` 规范
  - Changes：
    - [ADD] doc/RELEASE_NOTES_1.5.14.md: 新增 1.5.14 版本发布说明
    - [MOD] doc/WORKLOG.md: 记录发布说明文档产出
  - 多语言改动说明：无
  - 构建结果：沿用当前最近一次成功构建，版本 1.5.14（versionCode 33），输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：本轮仅生成发布文档，不变更应用功能与版本号
  - 下一步 TODO：按发布渠道需要进一步精简为应用商店短版文案

- 2026-03-10
  - 本轮上下文：补充 1.5.14 发布说明中的卡顿优化、启动提速与闪退修复内容，并重新构建版本
  - 关键决策：
    - 发布说明加入上一轮大数据量性能优化与稳定性修复，确保 release 文案与实际改动一致
    - 按当前版本管理规则重新构建并提升版本到 1.5.15 / 34
  - Changes：
    - [DEL] doc/RELEASE_NOTES_1.5.14.md: 删除与当前版本不一致的发布说明文件
    - [ADD] doc/RELEASE_NOTES_1.5.15.md: 新增 1.5.15 发布说明，补充性能优化、启动提速与新增闪退修复说明
    - [MOD] package.json: 版本号提升至 1.5.15
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.15 / 34
    - [MOD] doc/WORKLOG.md: 更新工作记忆与构建记录
  - 多语言改动说明：无
  - 构建结果：`npm run build`、`npx cap sync android`、`android\\gradlew assembleDebug` 全部成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：发布说明应与当前版本号保持一致，避免后续 release 使用时混淆
  - 下一步 TODO：确认 1.5.15 的构建与发布文档均已可直接用于 release

- 2026-03-11
  - 本轮上下文：结合源码、开发文档、doc 目录资料与 DeepWiki 项目介绍页，编写面向软件使用者的完整使用说明书
  - 关键决策：
    - 说明书以当前实际实现为准，DeepWiki 仅用作高层结构参考，功能细节优先采用源码与本地文档
    - 文档面向普通使用者，按“功能总览 -> 页面操作 -> 数据与备份 -> 常见问题”的顺序组织
  - Changes：
    - [ADD] doc/USER_MANUAL.md: 新增完整用户使用说明书，覆盖基础操作、AI、统计、导入导出、WebDAV、隐私与 FAQ
    - [MOD] package.json: 版本号提升至 1.5.16
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.16 / 35
    - [MOD] doc/WORKLOG.md: 更新工作记忆与构建记录
  - 多语言改动说明：无
  - 构建结果：`npm run build`、`npx cap sync android`、`android\\gradlew assembleDebug` 全部成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：用户使用说明书不需要额外拆分为多语言版本，中文单文档即可满足当前需求
  - 下一步 TODO：如需对外发布，可继续拆分为简版、新手版和 FAQ 独立文档

- 2026-03-11
  - 本轮上下文：从完整说明书中拆分新手快速上手文档，接入“我的”页面，并把文档入口同步到 README
  - 关键决策：
    - 新手快速上手采用应用内弹窗 + doc 独立 Markdown 双入口，兼顾 App 内查看与仓库文档浏览
    - 应用内展示内容全部走 constants.ts 多语言字典，避免新增未本地化的界面文字
  - Changes：
    - [ADD] doc/QUICK_START.md: 新增新手快速上手文档
    - [MOD] App.tsx: 在“我的”页面新增新手快速上手入口与说明弹窗
    - [MOD] constants.ts: 新增新手快速上手相关多语言文案
    - [MOD] README.md: 增加用户指南入口，指向 QUICK_START 与 USER_MANUAL
    - [MOD] package.json: 版本号提升至 1.5.17
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.17 / 36
    - [MOD] doc/WORKLOG.md: 更新工作记忆与构建记录
  - 多语言改动说明：新增新手快速上手入口、标题、步骤与提示文案，已覆盖 zh-CN / zh-TW / en / ja
  - 构建结果：`npm run build`、`npx cap sync android`、`android\\gradlew assembleDebug` 全部成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：用户更需要在 App 内快速看到核心操作步骤，而不是直接阅读长篇说明书
  - 下一步 TODO：如需进一步提升可发现性，可在首次启动时自动弹出一次快速上手

- 2026-03-11
  - 本轮上下文：用户反馈 APK 版本不对，执行 clean 重建并核验包内版本号
  - 关键决策：
    - 不依赖旧产物路径，直接执行 `gradlew clean assembleDebug` 强制重建
    - 使用 Android SDK `aapt dump badging` 直接读取 APK 包内版本，避免只看文件名或配置文件
  - Changes：
    - [MOD] doc/WORKLOG.md: 记录 APK 重建与版本核验结果
  - 多语言改动说明：无
  - 构建结果：`npm run build`、`npx cap sync android`、`android\\gradlew clean assembleDebug` 全部成功；经 `aapt` 核验，APK 版本为 1.5.17（versionCode 36），输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：标准输出目录一度缺少调试包，已通过重建恢复
  - Assumption：用户之前拿到的是旧 APK 或旧构建残留文件
  - 下一步 TODO：如需进一步降低误拿旧包的概率，可在构建后自动复制一份到项目根目录
