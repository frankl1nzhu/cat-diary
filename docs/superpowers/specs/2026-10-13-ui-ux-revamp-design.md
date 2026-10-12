# UI/UX 全面体验重构设计方案 (UI/UX Revamp Design)

**日期**：2026-10-13  
**状态**：已根据审查与用户确认完成定稿 (Approved Draft)  
**文件路径**：`docs/superpowers/specs/2026-10-13-ui-ux-revamp-design.md`

---

## 1. 背景与目标 (Intent & Goals)

### 1.1 背景
「喵记 Cat Diary」是一款专为猫咪家长打造的移动端优先 PWA 应用。随着应用功能逐步丰富（新增了物资预警、临期提醒、疫苗健康管理、延期提醒 Snooze、多猫切换、多成员家庭管理等），界面信息量大幅增长。目前存在以下用户体验痛点：
1. **首页垂直信息过载**：多个提醒卡片（低库存、临期、健康）平铺展开，首屏滚动过长，核心信息被冲淡。
2. **外观模式受限**：目前仅支持通过系统 `prefers-color-scheme` 触发深浅切换，无法手动强制指定；且部分次要文本在强光下对比度偏低。
3. **加载体验生硬**：数据未就绪时多采用局部旋转 Spinner 或白屏等待，存在布局跳跃（Layout Shift）。
4. **情感化与仪式感不足**：打卡缺少视觉与听觉正向反馈，部分空状态为枯燥文字，缺少养猫的趣味与温馨感。

### 1.2 目标 (Goals)
1. **首页视觉减负**：多个预警卡片自动收拢为轻量单行「待处理事项聚合条」（支持就地展开弹层/列表处理）；提供首页常用模块的就地折叠及「设置页」中的模块显隐管理。
2. **独立外观系统**：在设置页提供「明亮 / 暗黑 / 跟随系统」独立开关，与现有的粉/橙/蓝/极夜主题色解耦；微调次级文本对比度（WCAG AA 标准）。
3. **丝滑加载与动效**：首页和日志页接入 Shimmer 骨架屏占位；全局按钮添加弹性按压反馈（`:active { transform: scale(0.97) }`）；打卡成功触发猫爪微印章弹动动效。
4. **温馨情感化设计**：实现轻量手绘风格矢量 SVG 猫咪空状态插画；集成轻柔猫咪叫声短音效反馈（带设置页静音开关）；增加每日完成照料打卡后的猫爪微徽章。

### 1.3 非目标与反目标 (Non-goals & Anti-goals)
- **非目标**：重写底层数据库表结构或更改后端 API 数据结构。
- **反目标**：
  - 避免引入庞大的第三方重型 UI 库或图标库（保持 PWA 包体积轻量，首屏加载不受拖累）。
  - 避免强制播放声音导致尴尬（音效必须提供显式全局开关，且在静音模式或初次访问时不干扰用户）。
  - 避免过度花哨的复杂 3D 或厚重动画阻碍低端手机性能。

---

## 2. 详细架构与功能设计 (Detailed Design)

### 2.1 首页待处理事项聚合条 (AlertSummaryBar)
- **位置**：置于猫咪个人卡片正下方、快捷操作区上方。
- **展示逻辑**：
  - 计算待处理项总数：`activeAlertCount = lowInventory.length + allInventoryExpiryReminders.length + urgentHealthReminders.length`。
  - 若 `activeAlertCount === 0`，该条完全隐藏（高度为 0，最大化释放首屏空间）。
  - 若 `activeAlertCount === 1`，直接显示该单项卡片（保持极简无需多一层聚合）。
  - 若 `activeAlertCount >= 2`，渲染「待处理事项聚合条」：
    - 紧凑横条：显示醒目警示图标、总待办数量、以及最紧急项目摘要（如 `⚠️ 3 项待办：猫粮库存偏低等`）。
    - 交互：支持点击展开就地弹出详情抽屉/列表，可直接进行补货、延期（Snooze）或查看。处理完毕后聚合条自动动态更新并关闭。
    - 若用户在抽屉展开状态下完成了所有提醒的处理，抽屉内显示 `lazy_stretch`（伸懒腰小猫）空状态插画。

### 2.2 首页模块自定义折叠与隐藏 (Section Collapsing & Visibility)
- **模块范围（经确认）**：
  保持喂食记录在快捷弹窗中展示，不新增首页独立喂食卡片。首页可管理的模块包括：
  1. `quickActions`：快捷操作区（一键铲屎、想咪了、物资提醒入口）
  2. `mood`：今日心情日历模块
  3. `latestDiary`：最新日记模块
  4. `weekSummary`：本周数据汇总模块
- **持久化方案**：
  - 本地存储键：`cat_diary_dashboard_sections`。
  - 数据结构：
    ```ts
    interface DashboardSectionConfig {
      collapsed: Record<string, boolean> // 就地折叠状态
      hidden: Record<string, boolean>    // 完全隐藏状态
    }
    ```
- **交互**：
  - 卡片右上角添加轻量箭头图标（收起/展开），收起时仅保留标题与精简单行摘要。
  - 在「设置页 -> 界面偏好」中提供模块显隐开关，关闭的模块在首页彻底不渲染。

### 2.3 外观系统重构 (Appearance & Contrast)
- **外观模式定义**：
  ```ts
  export type AppearanceMode = 'system' | 'light' | 'dark'
  ```
- **实现原理**：
  - 存储键：`cat_diary_appearance`。
  - 在 `<html>` 上设置属性 `data-theme-mode="light" | "dark"`（若为 `'system'`，监听 `window.matchMedia('(prefers-color-scheme: light)')` 并动态设置对应值）。
  - CSS 规则将颜色变量绑定由原来的 `@media (prefers-color-scheme: light)` 扩展为兼顾 `html[data-theme-mode="light"]`。
- **色彩与对比度优化**：
  - 浅色模式下，将 `--color-text-secondary` 调整为更深更清晰的紫色调（提升可读性至 4.5:1 以上）：
    - `--color-text-secondary: #4a3e5e;` (原 #5a4f6e)
    - `--color-text-muted: #736787;` (原 #9990ab)
  - 确保烈日户外强光下文字清晰可见。

### 2.4 骨架屏加载与微动效体系 (Skeletons & Micro-interactions)
- **骨架屏**：
  - 组件 `DashboardSkeleton`：精确模拟猫咪卡片、快捷按钮栏、日记/统计摘要的布局轮廓。
  - 组件 `TimelineSkeleton`：模拟日志页时间轴列表项。
  - CSS 骨架扫光动效：
    ```css
    @keyframes skeleton-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    ```
- **微动效**：
  - **全局触控弹性**：在所有常用按钮、快速入口及卡片（`.btn`, `.timeline-chip`, `.quick-action-item`, `.card-interactive`）添加 `:active { transform: scale(0.97); transition: transform 80ms ease; }`。
  - **猫爪微印章动效**：在喂食、铲屎、记体重成功时，在视窗关键区域弹出一个半透明猫爪印章动效（带 Q 弹展开与渐隐），增强打卡成就感。

### 2.5 情感化设计：手绘空状态、猫咪音效与达标徽章 (Emotional Design)
- **矢量 SVG 猫咪空状态组件**：
  - `EmptyStateCat`：支持三种手绘姿态：
    1. `sleeping`：趴着睡觉的小猫（用于“暂无日记/记录”）。
    2. `hungry_bowl`：推着空碗的小猫（用于喂食弹窗中“今日暂无喂食记录”）。
    3. `lazy_stretch`：伸懒腰打哈欠的猫咪（用于待办处理完/暂无提醒）。
  - 矢量内联 SVG，无外部图片请求，配色严格遵循全局 CSS 变量 `--color-primary` / `--color-text-secondary`。
- **猫咪打卡短音效**：
  - 使用 Web Audio API 原生振荡器生成柔和清爽的短促双音调猫咪叫声（仿“喵呜~”，约 250ms），完全零外部网络加载。
  - 在「设置页」提供「打卡猫叫音效」开关（默认为开启，用户可一键静音）。
- **今日达标猫爪徽章**：
  - 判定规则（经确认）：当日已完成喂食（`todayFeeds.length > 0`）且（已记录心情 `todayMood != null` 或已记录便便 `todayPoops > 0`）。
  - 满足时，在猫咪卡片的名字旁点亮一枚微光金色小猫爪（🐾 今日已照料完毕），提供即时正向激励。

---

## 3. 约束与兼容性 (Constraints & Compatibility)
- **PWA 与离线可用**：所有 SVG 插画与音效生成必须完全本地化，断网状态下体验零降级。
- **无破坏性改动**：保持现有数据模型、已有 Theme Preset（粉/橙/蓝/紫）以及国际化（中/英）完全兼容。
- **性能指标**：无额外第三方 npm 依赖，打包体积增量控制在 < 10KB。

---

## 4. 交付与测试计划 (Verification & Testing)
1. **单元测试与集成测试**：
   - 测试 `AlertSummaryBar` 的聚合展开与计数逻辑。
   - 测试外观模式（`system` / `light` / `dark`）切换与持久化逻辑。
   - 测试模块折叠/隐藏持久化状态恢复。
   - 测试今日达标徽章判定条件。
2. **构建与 Lint 验证**：
   - `npm run lint` 必须 0 errors, 0 warnings。
   - `npm run typecheck` 必须通过。
   - `npm run test:unit` 全部通过。
   - `npm run build` 产物打包成功。
