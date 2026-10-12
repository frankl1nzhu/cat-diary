# UI/UX 全面体验重构实施计划 (UI/UX Revamp Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构「喵记」移动端 UI/UX 体验，包括首页预警聚合折叠条、首页模块自定义折叠与隐藏、外观深浅模式独立切换与 WCAG AA 文本对比度优化、骨架屏与触控微动效、以及手绘矢量猫咪空状态插画、打卡短音效与今日照料达标徽章。

**Architecture:** 采用分层解耦架构：外观模式（`data-theme-mode`）与既有主题色独立运行；音效通过 Web Audio API 本地合成零网络开销；插画采用轻量内联矢量 SVG；首页预警聚合条以状态衍生过滤实现零数据库迁移；模块折叠与偏好配置使用 LocalStorage 持久化。

**Tech Stack:** React 19, TypeScript, Vite, CSS Custom Properties, Web Audio API, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-13-ui-ux-revamp-design.md`

## Global Constraints
- 无破坏性改动：保持所有 Supabase 数据库表和既有主题色（pink, orange, blue, midnight）完全兼容。
- 零外部重量级依赖：不引入额外 UI 库或音频文件，PWA 增量包体积控制在 < 10KB。
- 离线优先：所有 SVG 插画、音效合成与骨架屏在断网状态下体验零降级。
- 质量门禁：必须保持 ESLint 0 errors 0 warnings、TypeScript 严格类型检查通过、测试全绿。

## Review Focus
1. 系统偏好变化：当用户选择「跟随系统」模式时，动态切换系统深浅色需实时响应 `prefers-color-scheme` 媒体查询变化。
2. 聚合条动态刷新：在聚合弹层内完成某一项的延期或补货后，待办计数与最紧急项摘要需即时更新；当待办清空至 0 时聚合条需平滑收拢消失。
3. 音效静音与浏览器自动播放限制：首次用户点击前不得触发 AudioContext 报错，且在静音开关关闭或静音模式下完全不发声。
4. 模块全部隐藏边界：若用户在设置中将首页模块全数隐藏，需保证猫咪卡片仍正常展示且无页面崩溃或白屏。
5. 骨架屏尺寸一致性：`DashboardSkeleton` 与 `TimelineSkeleton` 元素尺寸需与真实组件严格对齐，杜绝渲染前后的布局抖动（CLS）。

---

### Task 1: 外观模式独立切换与文本对比度优化 (Appearance & Contrast)

**Files:**
- Create: `src/lib/appearance.ts`
- Modify: `src/index.css:115-150`
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src/test/appearance.test.ts`

**Interfaces:**
- Produces:
  - `export type AppearanceMode = 'system' | 'light' | 'dark'`
  - `export function getStoredAppearance(): AppearanceMode`
  - `export function applyAppearanceMode(mode: AppearanceMode): void`
  - `export function initAppearanceListener(): () => void`

- [ ] **Step 1: 编写外观模式单元测试**

```ts
// src/test/appearance.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getStoredAppearance, applyAppearanceMode, AppearanceMode } from '../lib/appearance'

describe('appearance manager', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme-mode')
  })

  it('defaults to system mode when nothing stored', () => {
    expect(getStoredAppearance()).toBe('system')
  })

  it('sets data-theme-mode attribute when applying dark or light', () => {
    applyAppearanceMode('dark')
    expect(document.documentElement.getAttribute('data-theme-mode')).toBe('dark')
    expect(localStorage.getItem('cat_diary_appearance')).toBe('dark')

    applyAppearanceMode('light')
    expect(document.documentElement.getAttribute('data-theme-mode')).toBe('light')
    expect(localStorage.getItem('cat_diary_appearance')).toBe('light')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/test/appearance.test.ts`  
Expected: FAIL with module not found `../lib/appearance`

- [ ] **Step 3: 实现 `src/lib/appearance.ts` 并在 `src/index.css` 适配对比度**

在 `src/lib/appearance.ts` 中实现：
- 管理 `'system' | 'light' | 'dark'` 模式切换与持久化；
- 在 `html` 上根据当前模式和系统媒体查询设置 `data-theme-mode="light"` 或 `"dark"`。

在 `src/index.css` 中：
- 增加选择器 `html[data-theme-mode="light"]`，并将浅色模式下的 `--color-text-secondary` 调整为 `#4a3e5e`，`--color-text-muted` 调整为 `#736787`（达到 WCAG AA 对比度）；
- 增加选择器 `html[data-theme-mode="dark"]` 覆盖深色变量。

- [ ] **Step 4: 在 `SettingsPage.tsx` 中增加「明亮 / 暗黑 / 跟随系统」外观选项**

在设置页主题色选择器上方添加外观模式三选一切换器，支持即时切换并弹出 Toast。

- [ ] **Step 5: 运行测试并验证通过**

Run: `npx vitest run src/test/appearance.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/appearance.ts src/index.css src/pages/SettingsPage.tsx src/test/appearance.test.ts
git commit -m "feat(ui): add independent appearance mode toggle and enhance text contrast"
```

---

### Task 2: 触控微动效与 Web Audio 猫咪打卡短音效 (Micro-interactions & Audio)

**Files:**
- Create: `src/lib/sound.ts`
- Create: `src/components/ui/PawStampEffect.tsx`
- Modify: `src/index.css`
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src/test/sound.test.ts`

**Interfaces:**
- Produces:
  - `export function playMeowSound(): void`
  - `export function isSoundEnabled(): boolean`
  - `export function setSoundEnabled(enabled: boolean): void`
  - `<PawStampEffect visible={boolean} onComplete={() => void} />`

- [ ] **Step 1: 编写音效模块单元测试**

```ts
// src/test/sound.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { isSoundEnabled, setSoundEnabled } from '../lib/sound'

describe('sound module', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to enabled', () => {
    expect(isSoundEnabled()).toBe(true)
  })

  it('persists enabled and disabled status', () => {
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/test/sound.test.ts`  
Expected: FAIL with module not found `../lib/sound`

- [ ] **Step 3: 实现 `src/lib/sound.ts` 与 `PawStampEffect.tsx`**

在 `src/lib/sound.ts` 中：
- 使用 Web Audio API（AudioContext, OscillatorNode, GainNode）合成 250ms 的温和双音调“喵呜~”叫声（频率从约 880Hz 平滑过渡至 660Hz 并指数渐隐），带 `isSoundEnabled()` 检查与安全降级。

在 `src/components/ui/PawStampEffect.tsx` 中：
- 实现一个纯 CSS 动效的半透明金色猫爪印章（弹入并在 600ms 后渐隐回调）。

在 `src/index.css` 中：
- 为所有按钮、快捷键及卡片添加 `:active { transform: scale(0.97); transition: transform 80ms ease; }`。

在 `src/pages/SettingsPage.tsx` 中：
- 添加「打卡猫咪叫声」开关。

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/test/sound.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sound.ts src/components/ui/PawStampEffect.tsx src/index.css src/pages/SettingsPage.tsx src/test/sound.test.ts
git commit -m "feat(ui): add button scale feedback, paw stamp effect, and web audio meow sound"
```

---

### Task 3: 手绘矢量 SVG 猫咪空状态插画与今日达标徽章 (Empty States & Care Badge)

**Files:**
- Create: `src/components/ui/EmptyStateCat.tsx`
- Modify: `src/components/forms/FeedLogForm.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/components/dashboard/CatProfileCard.tsx`
- Test: `src/test/emptyStateCat.test.tsx`

**Interfaces:**
- Produces:
  - `<EmptyStateCat posture="sleeping" | "hungry_bowl" | "lazy_stretch" message={string} description?: string />`
  - `computeIsTodayCareComplete(feedsCount: number, mood: string | null, poopCount: number): boolean`

- [ ] **Step 1: 编写 EmptyStateCat 单元测试与今日达标计算测试**

```tsx
// src/test/emptyStateCat.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyStateCat, computeIsTodayCareComplete } from '../components/ui/EmptyStateCat'

describe('EmptyStateCat', () => {
  it('renders posture SVG and message', () => {
    render(<EmptyStateCat posture="hungry_bowl" message="今日暂无喂食记录" />)
    expect(screen.getByText('今日暂无喂食记录')).toBeDefined()
    expect(document.querySelector('svg')).not.toBeNull()
  })

  it('computes today care completion correctly', () => {
    expect(computeIsTodayCareComplete(0, '😸', 1)).toBe(false) // no feeds
    expect(computeIsTodayCareComplete(1, null, 0)).toBe(false) // feeds but no mood or poop
    expect(computeIsTodayCareComplete(1, '😸', 0)).toBe(true)  // feeds + mood
    expect(computeIsTodayCareComplete(2, null, 1)).toBe(true)  // feeds + poop
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/test/emptyStateCat.test.tsx`  
Expected: FAIL with module not found `../components/ui/EmptyStateCat`

- [ ] **Step 3: 实现 `EmptyStateCat.tsx` 并接入业务场景**

在 `src/components/ui/EmptyStateCat.tsx` 中：
- 绘制 3 种姿态的高品质手绘矢量 SVG（推空碗、蜷睡、伸懒腰），采用主题色柔和线框与腮红点缀；
- 导出 `computeIsTodayCareComplete` 纯函数。

在 `src/components/forms/FeedLogForm.tsx` 中：
- 当今日无喂食记录时，使用 `<EmptyStateCat posture="hungry_bowl" message="..." />` 替代纯文本提示。

在 `src/pages/DashboardPage.tsx` 中：
- 当无日记记录时，使用 `<EmptyStateCat posture="sleeping" message="..." />`。

在 `src/components/dashboard/CatProfileCard.tsx` 中：
- 传入达标状态，当满足条件时在猫咪名字旁展示带有微光的金色徽章（`🐾 今日已照料`）。

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/test/emptyStateCat.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/EmptyStateCat.tsx src/components/forms/FeedLogForm.tsx src/pages/DashboardPage.tsx src/components/dashboard/CatProfileCard.tsx src/test/emptyStateCat.test.tsx
git commit -m "feat(ui): add hand-drawn vector cat empty states and daily care completion badge"
```

---

### Task 4: 骨架屏加载体系 (Skeleton Shimmer Loading)

**Files:**
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/DashboardSkeleton.tsx`
- Create: `src/components/ui/TimelineSkeleton.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/LogPage.tsx`
- Test: `src/test/skeletons.test.tsx`

**Interfaces:**
- Produces:
  - `<DashboardSkeleton />`
  - `<TimelineSkeleton />`

- [ ] **Step 1: 编写骨架屏单元测试**

```tsx
// src/test/skeletons.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DashboardSkeleton } from '../components/ui/DashboardSkeleton'
import { TimelineSkeleton } from '../components/ui/TimelineSkeleton'

describe('Skeletons', () => {
  it('renders DashboardSkeleton with shimmer classes', () => {
    const { container } = render(<DashboardSkeleton />)
    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(3)
  })

  it('renders TimelineSkeleton with shimmer classes', () => {
    const { container } = render(<TimelineSkeleton />)
    expect(container.querySelectorAll('.skeleton-shimmer').length).toBeGreaterThan(3)
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/test/skeletons.test.tsx`  
Expected: FAIL with module not found

- [ ] **Step 3: 实现 `Skeleton.tsx`、`DashboardSkeleton.tsx` 与 `TimelineSkeleton.tsx`**

在 `src/components/ui/Skeleton.tsx` 中：
- 实现基础占位骨架与 CSS `@keyframes skeleton-shimmer` 扫光动效。
- `DashboardSkeleton` 组合出猫咪头像、胶囊按钮条、心情日历、日记卡片的精确轮廓。
- `TimelineSkeleton` 组合出日志时间轴的轮廓。

在 `DashboardPage.tsx` 和 `LogPage.tsx` 中：
- 在数据加载期（`loading === true`）展示对应的骨架屏替代生硬的局部 Spinner 或空白。

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/test/skeletons.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Skeleton.tsx src/components/ui/DashboardSkeleton.tsx src/components/ui/TimelineSkeleton.tsx src/pages/DashboardPage.tsx src/pages/LogPage.tsx src/test/skeletons.test.tsx
git commit -m "feat(ui): add shimmer skeletons for dashboard and timeline pages"
```

---

### Task 5: 首页预警聚合折叠条与模块自定义折叠/隐藏 (Alert Aggregation & Module Config)

**Files:**
- Create: `src/lib/dashboardSections.ts`
- Create: `src/components/dashboard/AlertSummaryBar.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src/test/alertSummaryBar.test.tsx`
- Test: `src/test/dashboardSections.test.ts`

**Interfaces:**
- Produces:
  - `<AlertSummaryBar lowInventory={...} expiryReminders={...} healthReminders={...} onSnooze={...} />`
  - `getDashboardSectionConfig(): DashboardSectionConfig`
  - `setDashboardSectionCollapsed(sectionId: string, collapsed: boolean): void`
  - `setDashboardSectionHidden(sectionId: string, hidden: boolean): void`

- [ ] **Step 1: 编写聚合条与模块配置单元测试**

```tsx
// src/test/alertSummaryBar.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertSummaryBar } from '../components/dashboard/AlertSummaryBar'
import { LanguageProvider } from '../lib/i18n'

describe('AlertSummaryBar', () => {
  it('renders nothing when activeAlertCount is 0', () => {
    const { container } = render(
      <LanguageProvider>
        <AlertSummaryBar lowInventory={[]} expiryReminders={[]} healthReminders={[]} onSnooze={() => {}} />
      </LanguageProvider>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders compact summary bar when multiple alerts exist', () => {
    render(
      <LanguageProvider>
        <AlertSummaryBar
          lowInventory={[{ id: '1', item_name: '猫粮', status: 'urgent' } as any]}
          expiryReminders={[{ id: '2', item_name: '罐头', hoursLeft: 12 } as any]}
          healthReminders={[]}
          onSnooze={() => {}}
        />
      </LanguageProvider>
    )
    expect(screen.getByText(/2 项待处理/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run src/test/alertSummaryBar.test.tsx`  
Expected: FAIL with module not found

- [ ] **Step 3: 实现 `dashboardSections.ts` 与 `AlertSummaryBar.tsx`**

在 `src/lib/dashboardSections.ts` 中：
- 管理 `quickActions`、`mood`、`latestDiary`、`weekSummary` 的折叠与隐藏配置，并持久化到 localStorage。

在 `src/components/dashboard/AlertSummaryBar.tsx` 中：
- 待办数为 0 时返回 `null`；
- 待办数 = 1 时平铺渲染该卡片；
- 待办数 $\ge 2$ 时渲染单行聚合胶囊条，点击可展开底部抽屉/卡片集合，内部支持一键延期（Snooze）和快捷操作，清空后抽屉显示 `lazy_stretch` 空状态。

在 `src/pages/DashboardPage.tsx` 中：
- 挂载 `AlertSummaryBar`；
- 根据模块配置折叠/隐藏 `quickActions`, `mood`, `latestDiary`, `weekSummary`；
- 卡片头部添加折叠/展开小箭头。

在 `src/pages/SettingsPage.tsx` 中：
- 增加「首页模块管理」开关清单，用户可自如开关各模块显示。

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/test/alertSummaryBar.test.tsx src/test/dashboardSections.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboardSections.ts src/components/dashboard/AlertSummaryBar.tsx src/pages/DashboardPage.tsx src/pages/SettingsPage.tsx src/test/alertSummaryBar.test.tsx src/test/dashboardSections.test.ts
git commit -m "feat(dashboard): add alert summary bar and customizable section collapsing/visibility"
```

---

### Task 6: 全局联调、验证与回归测试 (Full Integration & Verification)

**Files:**
- Modify: 全局微调文件如有必要

- [ ] **Step 1: 运行全量 ESLint 检查**

Run: `npm run lint`  
Expected: 0 errors, 0 warnings

- [ ] **Step 2: 运行 TypeScript 严格类型检查**

Run: `npm run typecheck`  
Expected: exit code 0, no errors

- [ ] **Step 3: 运行全量单元测试与回归测试套件**

Run: `npm run test:unit`  
Expected: 全量用例通过（现有 39 个用例 + 新增用例全绿）

- [ ] **Step 4: 运行 Vite 生产构建**

Run: `npm run build`  
Expected: 构建成功，产物正常生成

- [ ] **Step 5: Commit & Push**

```bash
git push origin main
```
