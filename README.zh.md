# 喵记 Cat Diary

> 极简猫咪生活记录，实时同步。

[English Documentation](./README.md)

---

## 简介

喵记帮助猫主人——无论是独自养猫还是和家人一起——在一个地方记录爱猫的日常：健康档案、喂食、体重、心情和物资。所有变更会即时同步到家庭组内所有设备。

## 功能特性

### 核心记录
- **日记** — 支持图片和心情标签的富文本记录（`#睡觉` `#干饭` `#玩耍` `#便便` `#捣乱` `#撒娇`）
- **便便记录** — 布里斯托大便分类法（1–7 级）+ 颜色分类，并自动检测异常
- **体重记录** — 随时间变化的折线图可视化
- **喂食状态** — 每天早餐、午餐、晚餐、零食分别记录
- **心情跟踪** — 每日心情日历（😸 😾 😴），含每周摘要

### 健康与保健
- **健康档案** — 疫苗 💉、驱虫 💊、就医 🏥、呕吐 🤮 事件记录
- **即将到期提醒** — 仪表盘显示疫苗、驱虫、复查等到期预警
- **物资管理** — 跟踪物资数量、每日消耗量和有效期
- **过期提醒** — 物资过期或即将过期时发送推送通知

### 协作功能
- **家庭组** — 创建家庭并生成邀请码，其他人输入邀请码加入
- **多猫支持** — 在同一家庭内切换多只猫咪
- **角色权限** — 家主、管理员、成员，各有不同权限
- **入组申请** — 新成员加入时支持审批流程
- **实时同步** — 所有变更即时显示在所有已连接设备上

### 统计与导出
- **体重图表** — 历史体重折线图
- **便便分析** — 布里斯托类型和颜色分布（饼图）
- **物资分析** — 库存量和消耗速度
- **数据导出** — 将完整报告导出为 HTML 或 CSV

### 应用体验
- **PWA** — 可安装到手机和桌面，支持离线使用
- **推送通知** — 浏览器推送健康和物资提醒
- **深色 / 浅色主题** — 多款预设主题
- **双语界面** — 完整的中文（简体 / 繁体）和英文支持
- **快捷操作** — 浮动操作按钮，在任意页面快速记录
- **下拉刷新** — 原生移动端操作体验

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 19、TypeScript、Vite 7 |
| 路由 | React Router 7 |
| 状态管理 | Zustand 5 |
| 后端 | Supabase（PostgreSQL + Auth + Realtime + Edge Functions）|
| 图表 | Recharts 3 |
| PWA | Vite PWA Plugin + Workbox |
| 通知 | Web Push API + Supabase Edge Functions |
| 性能 | TanStack Virtual（虚拟列表）、路由级代码分割 |
| 测试 | Vitest（单元测试）+ Playwright（E2E）|

---

## 快速开始

### 前置条件

- Node.js 18+
- 一个 [Supabase](https://supabase.com) 项目

### 1. 克隆并安装依赖

```bash
git clone https://github.com/frankl1nzhu/cat-diary.git
cd cat-diary
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

> `VITE_VAPID_PUBLIC_KEY` 仅在需要推送通知时填写。可通过 `npx web-push generate-vapid-keys` 生成 VAPID 密钥对。

### 3. 初始化数据库

将所有迁移应用到你的 Supabase 项目：

```bash
npx supabase db push
```

或者通过 Supabase 控制台，按顺序执行 `supabase/migrations/` 目录下的 SQL 文件。

### 4. 启动开发服务器

```bash
npm run dev
```

在浏览器中打开 `http://localhost:5173`。

---

## 脚本命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm run typecheck` | TypeScript 类型检查（不输出文件）|
| `npm run lint` | ESLint 代码检查 |
| `npm run test:unit` | 单元测试（Vitest）|
| `npm run test:unit:watch` | 单元测试监听模式 |
| `npm run test:e2e` | 端对端测试（Playwright）|
| `npm run test:e2e:ui` | Playwright UI 模式的 E2E 测试 |

---

## 项目结构

```
src/
├── pages/           # 路由级组件（Dashboard、Log、Stats、Settings、Login）
├── components/
│   ├── ui/          # 通用 UI 组件（Modal、Toast、Lightbox 等）
│   ├── layout/      # 应用外壳（AppLayout、BottomNav 等）
│   └── dashboard/   # 仪表盘专属组件
├── stores/          # Zustand 状态存储（auth、cats、app、toast、quickActions）
├── hooks/           # 自定义 React Hooks
├── lib/             # 工具库（i18n、主题、推送通知、Supabase 客户端等）
└── types/           # 共享 TypeScript 类型定义

supabase/
├── migrations/      # 18 个有序 SQL 迁移文件
└── functions/
    └── send-reminders/   # 每日提醒 Edge Function（Deno）
```

---

## 数据库概览

Supabase 中管理的核心表（均启用行级安全策略 RLS）：

| 表名 | 用途 |
|---|---|
| `profiles` | 用户账号（用户名、邮箱、手机号）|
| `families` | 家庭组（含邀请码）|
| `family_members` | 用户与家庭的关系及角色 |
| `family_join_requests` | 待处理的入组申请 |
| `cats` | 猫咪档案（名字、品种、生日、头像）|
| `diary_entries` | 带图片和标签的文字日记 |
| `diary_comments` | 日记评论 |
| `diary_reactions` | 日记表情回应 |
| `poop_logs` | 每次便便的布里斯托类型和颜色 |
| `weight_records` | 体重历史 |
| `health_records` | 疫苗、驱虫、就医、呕吐事件 |
| `feed_status` | 每日喂食记录 |
| `mood_logs` | 每日每猫心情 |
| `inventory_items` | 物资数量和有效期跟踪 |
| `inventory_expiry_reminders` | 过期提醒配置 |
| `push_subscriptions` | Web Push 订阅端点存储 |

---

## 推送通知配置

本应用使用 Web Push API 实现浏览器推送通知。

1. 生成 VAPID 密钥对，并将公钥设置为 `VITE_VAPID_PUBLIC_KEY` 环境变量。
2. 在 Supabase 项目的 Edge Function 密钥中设置对应的 `VAPID_PRIVATE_KEY` 和 `VAPID_SUBJECT`。
3. `send-reminders` Edge Function 通过 `pg_cron` 定时运行，自动发送健康档案和物资的到期提醒通知。

---

## 许可证

[MIT](./LICENSE)
