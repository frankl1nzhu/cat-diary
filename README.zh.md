# 喵记 · Cat Diary

一款以移动端为优先的渐进式 Web 应用（PWA），用于记录猫咪家庭的日常生活——喂食、健康、日记等，支持多用户实时同步。

> **[English Documentation →](./README.md)**

---

## 功能概览

### 首页（Dashboard）
- 猫咪资料卡：头像、品种、生日
- 每周概览：喂食次数、心情统计、体重变化
- 月度心情日历，每天用表情标记
- 快捷操作：写日记、记便便、喂食、体重、库存、健康档案
- 库存提醒（充足 / 偏低 / 告急）
- 临期提醒（距过期剩余小时数）
- 即将到来的健康提醒：疫苗、驱虫、就医

### 记录（Log）
- 统一时间线：日记、便便记录、体重记录
- 日记支持文字、图片和标签（睡觉、干饭、捣乱、便便、玩耍、撒娇）
- 日记评论与 emoji 点赞
- 便便记录：布里斯托大便分类法（1–7）+ 颜色（自动判断是否异常）
- 体重记录与趋势可视化
- 支持搜索和类型筛选
- 图片灯箱查看器
- 移动端左滑删除
- 下拉刷新

### 统计（Stats）
- 体重趋势折线图（带日期范围选择器）
- 便便统计：布里斯托分布、颜色饼图
- "想猫了"打卡记录
- 喂食规律与库存消耗趋势
- 健康档案管理（疫苗、驱虫、就医历史）
- 库存管理与临期追踪
- 数据导出：体重、便便、想猫、健康、库存、日记、心情、喂食
- HTML 报告生成

### 设置（Settings）
- 猫咪资料管理，支持头像上传
- **家庭模式**：创建家庭、通过邀请码邀请成员、审批/拒绝加入申请
- 家庭成员角色：主人 / 管理员 / 成员
- 多猫支持，顶部切换器
- 主题切换：深色/浅色，多种预设颜色
- Web 推送通知配置与测试
- PWA 安装引导
- 语言切换：English / 简体中文
- 数据导入/导出

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite |
| 状态管理 | Zustand 5 |
| 后端 / 数据库 | Supabase（Auth、PostgreSQL、Storage、Realtime） |
| 图表 | Recharts 3 |
| 路由 | React Router DOM 7 |
| PWA | vite-plugin-pwa + Workbox |
| 国际化 | 自定义 Context（英文 + 简体中文） |
| 测试 | Vitest（单元测试）+ Playwright（E2E 测试） |

---

## 快速开始

### 前置条件

- Node.js 20+
- 一个 [Supabase](https://supabase.com) 项目

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

### 3. 执行数据库迁移

按顺序在 Supabase 控制台 SQL 编辑器或 CLI 中执行以下迁移文件：

```
supabase/migrations/
├── 00001_initial_schema.sql        # 核心表结构、枚举、RLS、Realtime、Storage
├── 00002_push_subscriptions.sql    # Web 推送订阅表
├── 00003_family_mode.sql           # 家庭和成员关系
├── 00004_family_rls_and_roles.sql  # 家庭 RLS 策略与角色
├── 00005_dissolve_and_admin.sql    # 家庭解散 + 管理员角色
├── 00006_create_join_family_rpc.sql # join_family_by_code() RPC
└── ...                             # 更多迁移文件
```

或使用 Supabase CLI 一键推送：

```bash
supabase db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

---

## Web 推送通知（完整配置）

### 1. 生成 VAPID 密钥

```bash
npx web-push generate-vapid-keys
```

### 2. 在前端设置公钥

```env
# .env.local
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

### 3. 在 Supabase Edge Function 设置密钥

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
supabase secrets set SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 部署 Edge Function

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

### 5. 在应用内启用

进入 **设置 → 通知**，开启推送权限，发送一条测试推送。

**支持的通知类型：** 日记、评论、喂食、健康档案、库存告急、体重、便便异常、想猫打卡、猫咪资料更新、家庭入驻申请、每周总结等。

---

## 家庭模式

家庭模式允许多个用户实时共享同一只猫的数据。

1. 某用户在 **设置 → 家庭** 中创建家庭，获得邀请码。
2. 其他用户输入邀请码申请加入。
3. 主人或管理员审批加入申请。
4. 所有家庭成员共享同一套猫咪数据，通过 Supabase Realtime 实时同步。

**角色权限：** `主人（owner）` → `管理员（admin）` → `成员（member）`

---

## 数据库结构概览

| 表名 | 说明 |
|---|---|
| `cats` | 猫咪资料 |
| `profiles` | 用户资料（注册时自动创建） |
| `families` | 家庭信息与邀请码 |
| `family_members` | 成员关系与角色 |
| `family_join_requests` | 加入申请审批流 |
| `diary_entries` | 日记（文字 + 图片 + 标签） |
| `mood_logs` | 每日心情（😸 / 😾 / 😴） |
| `poop_logs` | 便便记录（布里斯托分类 + 颜色） |
| `weight_records` | 体重记录（kg） |
| `miss_logs` | 想猫打卡时间戳 |
| `feed_status` | 喂食记录与餐食类型 |
| `health_records` | 疫苗 / 驱虫 / 就医历史 |
| `inventory` | 物资库存与告警阈值 |
| `inventory_expiry_reminders` | 物资临期追踪 |
| `push_subscriptions` | Web 推送 VAPID 订阅端点 |
| `countdowns` | 自定义及自动生成的倒计时 |

所有表均启用 **行级安全（RLS）**，用户只能访问自己家庭的数据。

---

## 常用命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产环境构建
npm run preview      # 本地预览生产包
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 代码检查
```

---

## 测试

### 单元测试

覆盖 `Modal` 组件行为：点击遮罩关闭、点击关闭按钮、标题和内容渲染。

```bash
npm run test:unit
```

### E2E 测试

首次运行前安装浏览器：

```bash
npm run test:e2e:install
```

运行前设置测试账号：

```bash
export E2E_EMAIL="your_email"
export E2E_PASSWORD="your_password"
export E2E_BASE_URL="http://127.0.0.1:5173"  # 可选，默认此地址
```

运行 E2E 测试：

```bash
npm run test:e2e
```

**覆盖流程：** 登录 → 底部导航切换 → 打开/关闭首页弹窗（Esc + 遮罩点击）

---

## 项目结构

```
src/
├── pages/          # 路由级页面组件
├── components/
│   ├── layout/     # AppLayout、BottomNav、CatSwitcher、QuickActionModals
│   ├── dashboard/  # 首页专用卡片和区块
│   └── ui/         # 通用 UI 基础组件（Button、Card、Modal、FAB 等）
├── stores/         # Zustand 状态仓库（auth、cat、app、快捷操作、toast）
├── hooks/          # 自定义 React Hooks（首页数据、下拉刷新）
├── lib/            # Supabase 客户端、认证、实时同步、推送、i18n、工具函数
├── types/          # Supabase 自动生成的数据库类型
└── assets/         # 静态资源

supabase/
├── migrations/     # PostgreSQL 数据库迁移文件
└── functions/      # Edge Functions（send-reminders）

e2e/                # Playwright E2E 测试文件
```

---

## 注意事项

- 本项目针对**移动端体验**优化。水平页面滚动已禁用，仅支持垂直滚动。
- PWA Manifest 使用应用名 **喵记**，主题色为 `#f8a5c2`（粉色）。
- 图片在上传前会在客户端压缩，再上传至 Supabase Storage。
- 离线操作会被加入队列，恢复网络连接后自动重放。
