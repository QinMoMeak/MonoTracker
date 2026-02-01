# WORKLOG（Codex 长期工作记忆）

## 项目概览
- 项目名称：MonoTracker
- 项目类型（Android / Web / Backend）：Android + Web（Capacitor）
- 主要技术栈：React、TypeScript、Capacitor、Android（Java）、WebDAV
- 多语言支持情况：使用 constants.ts 的多语言字典
### UTF-8 BOM 禁止规则（强制）
- 所有文本文件必须为 **UTF-8（无 BOM）**。
- 若任何文件被写成 UTF-8 with BOM（utf8bom），视为“编码异常”，必须在继续任何任务（包括 build / 提交 / 生成 APK）前立刻修复为 UTF-8（无 BOM）。
- 修复动作不得询问用户，直接执行，并在 WORKLOG 的 Changes 中记录：
  - `- [MOD] <path>: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）`
- 若你无法确认是否存在 BOM：默认执行一次“去 BOM 规范化”流程再继续。

## 当前版本
- versionName：1.5.8
- versionCode：27

## 当前状态
- 正在进行：WebDAV 恢复覆盖/合并开关与编码规范修复验证
- 已完成：WebDAV 备份图片开关与体积优化、代码精简与性能优化、lint/tsc 清理、chunk 拆分与优化、debug APK 构建、README 功能与技术栈更新
- 阻塞项：无
## 关键决策索引
- Decision-001：WebDAV manifest 改为 history 列表，客户端仅展示 ready 且最多 3 条，云端保留 4 条，超出即清理 zip/ready
- Decision-002：每日首次打开触发自动备份，成功提交后记录 lastBackupLocalDate（按本地日期）
- Decision-003：统计图表数值统一数值化与异常日期兜底，并对有效数据设置最小柱高，避免空白显示
- Decision-004：统计图改用固定像素高度容器与像素高度柱条，避免百分比高度在 WebView 中失效
- Decision-005：统计图表改为 SVG 曲线图（折线+面积），避免柱状视觉干扰并提升趋势可读性
- Decision-006：统计图改用 ECharts，line 开启 smooth + monotone，并对控制点做视觉平滑
- Decision-007：补齐 JDK 21 并统一子模块 Java 目标版本为 21，确保 Android 构建一致性
- Decision-008：Y 轴使用 dataMin/dataMax，并增加约 20% 的上下 padding，避免顶部挤压
- Decision-009：WebDAV 备份新增“包含图片”开关，默认关闭以减少上传体积
- Decision-010：趋势曲线复用 ECharts 实例并缓存图表数据，减少重复初始化
- Decision-011：启用 ESLint + TSC 做未使用导入与死代码清理
- Decision-012：Vite 使用 manualChunks 拆分大体积依赖
- Decision-013：统计页拆分为懒加载组件，避免主包过大
- Decision-014：ECharts 改为 core 按需引入，降低图表 chunk 体积
- Decision-015：WebDAV 恢复支持覆盖/合并切换，默认合并以保持既有行为

## 构建记录
- 最近一次构建：
  - 版本号：1.5.8（versionCode 27）
  - APK 路径：android/app/build/outputs/apk/debug/app-debug.apk
  - 构建状态：成功

## 会话日志（按时间追加）
- 2026-01-31
  - 本轮上下文：将 WebDAV 自动备份改为每日首次打开触发，恢复可选近三次，云端保留近四次，根目录改为 TrackerBackups，并完成构建产出 APK
  - 关键决策：
    - 使用 history 清单替代 current/previous，展示需 ready 且最多 3 条，清理超出 4 条的 zip/ready
    - 自动备份成功提交后再写 lastBackupLocalDate，避免失败误判
  - Changes：
    - [MOD] App.tsx: WebDAV 备份逻辑改为每日首次、manifest history、恢复列表 UI、根目录切换为 TrackerBackups
    - [MOD] services/webdavService.ts: 新增 WebDAV exists/delete API 封装
    - [MOD] android/app/src/main/java/com/Tracker/app/WebdavPlugin.java: 新增 exists/delete 插件方法
    - [MOD] constants.ts: 更新自动备份提示与恢复列表文案（多语言）
    - [MOD] types.ts: 增加 lastBackupLocalDate
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.1 / 5
    - [ADD] doc/WORKLOG.md: 初始化并记录工作记忆
  - 多语言改动说明：新增 WebDAV 恢复列表相关文案与提示，已覆盖 zh-CN/zh-TW/en/ja
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：用户要求记忆文件路径为 doc/WORKLOG.md，已按此路径创建并记录
  - Assumption：每日首次打开判断使用设备本地日期
  - 下一步 TODO：验证 WebDAV 恢复流程与清理策略在真实坚果云目录中的表现



- 2026-01-31
  - 本轮上下文：统计页两处曲线图不显示，修复统计图数据兜底与显示逻辑，并完成构建产出 APK
  - 关键决策：
    - 统计图数据统一使用 toNumber 进行数值化，异常日期使用当前时间兜底
    - 对有效数据设置最小柱高，避免 0 或 NaN 导致空白
  - Changes：
    - [MOD] App.tsx: 统计图数值与日期兜底，增加总量判断与最小柱高渲染
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.2 / 6
    - [MOD] doc/WORKLOG.md: 修复编码为 UTF-8 并更新记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：WORKLOG 原内容出现编码异常，已统一为 UTF-8
  - Assumption：统计图空白与数据为 0 或异常数值相关
  - 下一步 TODO：确认真实数据下曲线显示是否符合预期



- 2026-01-31
  - 本轮上下文：统计图仍不显示，改为固定像素高度渲染并完成构建产出 APK
  - 关键决策：
    - 柱条高度改为像素计算，容器固定高度，避免百分比高度在 WebView 中失效
  - Changes：
    - [MOD] App.tsx: 统计图容器与柱条改为固定像素高度
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.3 / 7
    - [MOD] doc/WORKLOG.md: 统一编码并更新记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：WORKLOG 编码异常已再次统一为 UTF-8
  - Assumption：统计图空白与容器高度百分比在 WebView 不生效有关
  - 下一步 TODO：确认统计图在真机与模拟器上显示效果



- 2026-01-31
  - 本轮上下文：统计图改为曲线图展示并完成构建产出 APK
  - 关键决策：
    - 统计图改为 SVG 折线+面积展示，并补充数值/标签对齐
  - Changes：
    - [MOD] App.tsx: 月度趋势与持有时长分布改为曲线图渲染
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.4 / 8
    - [MOD] doc/WORKLOG.md: 更新曲线图改造记录与构建信息
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：SVG 折线在 WebView 中可稳定渲染
  - 下一步 TODO：确认曲线图在真实数据与不同主题下显示效果



- 2026-01-31
  - 本轮上下文：曲线图太生硬，改为平滑曲线并完成构建产出 APK
  - 关键决策：
    - 使用 Catmull-Rom 转贝塞尔曲线生成平滑路径，提升丝滑感
  - Changes：
    - [MOD] App.tsx: 曲线图路径改为平滑贝塞尔曲线
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.5 / 9
    - [MOD] doc/WORKLOG.md: 更新平滑曲线改造记录与构建信息
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：平滑曲线在 WebView 中渲染稳定且不引入抖动
  - 下一步 TODO：确认平滑曲线在少量点位时的视觉效果



- 2026-01-31
  - 本轮上下文：按“视觉优先”标准调整趋势曲线，并完成构建产出 APK
  - 关键决策：
    - 使用视觉平滑值 + 单调三次样条生成曲线，降低折点与鼓包
  - Changes：
    - [MOD] App.tsx: 趋势曲线路径改为视觉平滑 + 单调三次样条
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.6 / 10
    - [MOD] doc/WORKLOG.md: 更新视觉优先曲线改造记录与构建信息
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：单调样条在小样本点位下依旧保持自然过渡
  - 下一步 TODO：观察极端数据（突增/突降）时的视觉稳定性



- 2026-01-31
  - 本轮上下文：按要求改用 ECharts 生成趋势曲线并做控制点视觉平滑，完成构建产出 APK
  - 关键决策：
    - 使用 ECharts line 系列 smooth + cubicInterpolationMode: 'monotone'
    - 对数据点做轻量视觉平滑并限制在相邻范围内，减少中段塌陷
  - Changes：
    - [MOD] App.tsx: 统计曲线改用 ECharts 渲染并加入视觉平滑
    - [MOD] package.json: 增加 echarts 依赖
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.7 / 11
    - [MOD] doc/WORKLOG.md: 更新 ECharts 改造记录与构建信息
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：ECharts 在 WebView 中渲染稳定且性能可接受
  - 下一步 TODO：确认 ECharts 曲线在不同主题与不同数据密度下的观感



- 2026-01-31
  - 本轮上下文：修复 Vite 无法解析 echarts 依赖问题，补齐 JDK 21 并完成构建产出 APK
  - 关键决策：
    - 使用 npm 无锁文件安装方式解决锁文件版本不存在问题，并加入 overrides 限定缺失包版本
    - 在项目内下载 JDK 21，并将子模块 Java 目标版本统一为 21
  - Changes：
    - [MOD] package.json: 增加 echarts 依赖与 overrides 版本约束
    - [MOD] android/build.gradle: 子模块 Java 目标版本统一为 21
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.8 / 12
    - [ADD] .jdk/jdk-21.0.9+10: 本地 JDK 21 目录用于构建
    - [MOD] doc/WORKLOG.md: 更新依赖修复与构建记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：npm install 使用 --no-package-lock 避开锁文件版本不存在错误
  - Assumption：本地 JDK 21 目录仅用于构建，不影响运行时
  - 下一步 TODO：确认 Vite 开发环境已能正常解析 echarts



- 2026-01-31
  - 本轮上下文：为趋势曲线 Y 轴增加上下 padding，避免点位挤在顶部，并完成构建产出 APK
  - 关键决策：
    - Y 轴使用 dataMin/dataMax 并设置 20% 边界间距，提升视觉留白
  - Changes：
    - [MOD] App.tsx: ECharts Y 轴增加 dataMin/dataMax 与 20% 上下 padding
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.9 / 13
    - [MOD] doc/WORKLOG.md: 更新纵轴 padding 记录与构建信息
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：20% 边界间距在多数数据量级下可保持稳定观感
  - 下一步 TODO：检查极小波动数据下的曲线视觉比例






- 2026-01-31
  - 本轮上下文：WebDAV 网盘界面新增“包含图片”开关，默认关闭以减少上传体积，并完成 debug APK 构建
  - 关键决策：
    - WebDAV 备份按 includeImages 开关决定是否打包图片
  - Changes：
    - [MOD] App.tsx: WebDAV 备份新增包含图片开关并应用到自动/手动上传
    - [MOD] services/backupService.ts: buildExportZip 增加 includeImages 参数
    - [MOD] constants.ts: 新增包含图片文案（zh-CN/zh-TW/en/ja）
    - [MOD] types.ts: AppState 增加 webdavIncludeImages
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.13 / 17
    - [MOD] doc/WORKLOG.md: 更新 WebDAV 图片开关记录与构建信息
  - 多语言改动说明：新增 WebDAV 包含图片开关文案，已覆盖 zh-CN/zh-TW/en/ja
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：WORKLOG 版本号与实际构建版本不一致，已同步修正
  - Assumption：关闭图片打包可显著降低 WebDAV 上传体积
  - 下一步 TODO：验证关闭图片后的恢复流程是否符合预期

- 2026-01-31
  - 本轮上下文：按要求精简代码与优化运行逻辑，提升统计图渲染性能，并完成 debug APK 构建
  - 关键决策：
    - 趋势曲线复用 ECharts 实例，避免反复 init/dispose
    - 统计曲线数据先 memo 化，减少无效渲染
    - 删除未使用的 WebDAV 错误格式化函数
  - Changes：
    - [MOD] App.tsx: 复用 ECharts 实例与缓存图表数据，移除未使用函数
    - [MOD] android/app/build.gradle: 版本号提升至 1.4.14 / 18
    - [MOD] doc/WORKLOG.md: 更新性能优化记录与构建信息
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：复用 ECharts 实例可减少渲染开销并提升稳定性
  - 下一步 TODO：观察统计页切换与主题变化时的曲线渲染是否稳定

- 2026-01-31
  - 本轮上下文：启用 lint/tsc 清理未使用导入与死代码，修复 dev server 依赖问题，生成 1.5.0 debug APK，并撰写发布说明
  - 关键决策：
    - 使用 ESLint flat config + unused-imports 插件批量清理无用代码
    - 使用 TSC 做类型校验并修正 Map 类型与事件监听句柄
  - Changes：
    - [ADD] eslint.config.cjs: ESLint flat 配置用于未使用导入清理
    - [MOD] package.json: 增加 lint/typecheck 脚本与 ESLint 依赖，版本号更新至 1.5.0
    - [MOD] App.tsx: 移除无用插件与变量，修复类型错误，优化统计逻辑
    - [MOD] components/AddItemModal.tsx: 清理无用变量
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.0 / 19
    - [ADD] RELEASE_NOTES_1.5.0.md: 1.4.0 → 1.5.0 发布说明
    - [MOD] doc/WORKLOG.md: 更新 lint/tsc 与发版记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：npm 安装遇到锁文件版本问题，改用 --no-package-lock 安装 ESLint 相关依赖
  - Assumption：ESLint 自动修复对现有功能无行为变化
  - 下一步 TODO：确认 dev server 可正常启动并检查 lint/tsc 结果

- 2026-02-01
  - 本轮上下文：按需求启用 Vite manualChunks 拆分大包，降低 chunk 体积告警，并完成 debug APK 构建
  - 关键决策：
    - 将 echarts、react、genai、capacitor 相关依赖单独拆分为独立 chunk
  - Changes：
    - [MOD] vite.config.ts: 添加 rollupOptions.output.manualChunks 拆分大依赖
    - [MOD] package.json: 版本号更新至 1.5.1
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.1 / 20
    - [MOD] doc/WORKLOG.md: 更新分包与构建记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：manualChunks 有助于降低单个 chunk 体积告警
  - 下一步 TODO：运行 npm run build 验证告警是否减少




- 2026-02-01
  - 本轮上下文：继续拆分大包，统计页改为懒加载组件并完成 debug APK 构建
  - 关键决策：
    - 统计页独立成 StatsTab 组件，ECharts 随需加载
  - Changes：
    - [ADD] components/StatsTab.tsx: 统计页拆分为独立组件并包含趋势图渲染
    - [MOD] App.tsx: 统计页改为 React.lazy + Suspense 懒加载
    - [MOD] package.json: 版本号更新至 1.5.2
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.2 / 21
    - [MOD] doc/WORKLOG.md: 更新拆分与构建记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：npm run build 仍提示 echarts chunk 超过 500 kB
  - Assumption：统计页懒加载可降低主包体积告警
  - 下一步 TODO：评估使用 echarts/core 按需引入或提高 chunkSizeWarningLimit


- 2026-02-01
  - 本轮上下文：继续拆分大包，改为 ECharts core 按需引入并清理空分包，完成 debug APK 构建
  - 关键决策：
    - 统计页使用 echarts/core + LineChart + GridComponent + CanvasRenderer 进行按需加载
    - 移除空的 genai manualChunks，避免构建告警
  - Changes：
    - [MOD] components/StatsTab.tsx: 改为 echarts/core 按需引入并注册组件
    - [MOD] vite.config.ts: manualChunks 调整，移除空分包并匹配 echarts/core
    - [MOD] package.json: 版本号更新至 1.5.4
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.4 / 23
    - [MOD] doc/WORKLOG.md: 更新拆分与构建记录
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：npm run build 不再出现 chunk 体积告警
  - Assumption：echarts/core 按需引入能显著降低图表 chunk 体积
  - 下一步 TODO：确认统计页功能在真机上渲染正常

- 2026-02-01
  - 本轮上下文：依据现有功能更新 README，补充技术栈与功能说明，并完成 debug APK 构建
  - 关键决策：
    - README 补充 ECharts/JSZip/WebDAV/ESLint+TSC 等现有技术与功能点
  - Changes：
    - [MOD] README.md: 更新功能特性与开发技术说明
    - [MOD] package.json: 版本号更新至 1.5.6
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.6 / 25
    - [MOD] doc/WORKLOG.md: 记录 README 更新与构建信息
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：README 以现有功能为准进行总结
  - 下一步 TODO：补充 RELEASE_NOTES_1.5.6

- 2026-02-01
  - 本轮上下文：修复 README 与 WORKLOG 的 UTF-8 BOM，更新版本并完成 debug APK 构建
  - 关键决策：
    - 统一为 UTF-8（无 BOM）以符合编码规范
  - Changes：
    - [MOD] README.md: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/WORKLOG.md: 去除 UTF-8 BOM 并更新构建记录
    - [MOD] package.json: 版本号更新至 1.5.7
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.7 / 26
  - 多语言改动说明：无
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：Gradle 找不到 JDK 21，构建时设置 JAVA_HOME 指向 .jdk/jdk-21.0.9+10
  - Assumption：仅移除 BOM 不影响运行行为
  - 下一步 TODO：无
- 2026-02-01
  - 本轮上下文：WebDAV 恢复新增“覆盖/合并”选择并统一去除 UTF-8 BOM，完成 debug APK 构建
  - 关键决策：
    - 恢复模式默认合并，覆盖需二次确认以避免误操作
  - Changes：
    - [MOD] App.tsx: 新增 WebDAV 恢复方式选择并支持覆盖/合并
    - [MOD] constants.ts: 新增恢复方式相关文案（多语言）
    - [MOD] types.ts: 增加 RestoreMode 与 webdavRestoreMode
    - [MOD] package.json: 版本号更新至 1.5.8
    - [MOD] android/app/build.gradle: 版本号提升至 1.5.8 / 27
    - [MOD] doc/WORKLOG.md: 更新恢复方式与编码修复记录
    - [MOD] App.tsx: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] capacitor.config.ts: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] constants.ts: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] eslint.config.cjs: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] types.ts: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] components/StatsTab.tsx: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/index.html: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/RELEASE_NOTES_1.2.0.md: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/RELEASE_NOTES_1.3.0.md: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/RELEASE_NOTES_1.4.0.md: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/RELEASE_NOTES_1.5.0.md: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/pages/ai-settings.html: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/pages/home.html: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] doc/pages/stats.html: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] services/aiProviders.ts: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] services/aiService.ts: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
    - [MOD] services/webdavService.ts: 去除 UTF-8 BOM，统一为 UTF-8（无 BOM）
  - 多语言改动说明：新增 WebDAV 恢复方式文案，已覆盖 zh-CN/zh-TW/en/ja
  - 构建结果：debug APK 构建成功，输出 android/app/build/outputs/apk/debug/app-debug.apk
  - 冲突与修正：无
  - Assumption：恢复默认合并以保持既有行为
  - 下一步 TODO：无
