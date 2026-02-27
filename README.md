# cat-diary（喵记）

移动端优先的猫咪家庭记录应用，支持实时同步：
- 首页：喂食、便便、心情、倒计时、库存提醒
- 记录：日记时间线、照片、体重
- 统计：体重趋势、健康记录、库存管理
- 设置：猫咪档案、头像上传、PWA 安装

## 技术栈

- React 19 + TypeScript + Vite
- Supabase（Auth / Postgres / Storage / Realtime）
- Zustand（客户端状态）
- Recharts（图表）
- PWA（vite-plugin-pwa）

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置环境变量（项目根目录 `.env.local`）

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

3. 启动开发环境

```bash
npm run dev
```

## 数据库初始化

- 迁移文件：`supabase/migrations/00001_initial_schema.sql`
- 包含：枚举、表结构、RLS、Realtime 发布、Storage bucket 策略
- 推送订阅表：`supabase/migrations/00002_push_subscriptions.sql`

## Web Push（完整链路）

1) 生成 VAPID 密钥（任意支持 web-push 的工具）

2) 前端环境变量：

```env
VITE_VAPID_PUBLIC_KEY=...
```

3) Supabase Edge Function Secrets（发送端）

```bash
supabase secrets set VAPID_PUBLIC_KEY=...
supabase secrets set VAPID_PRIVATE_KEY=...
supabase secrets set SUPABASE_ANON_KEY=...
```

4) 部署推送函数：

```bash
supabase functions deploy send-reminders
```

5) 在应用设置页执行：
- 开启通知权限
- 发送测试推送

## 常用命令

```bash
npm run dev          # 开发模式
npm run build        # 构建生产包
npm run preview      # 本地预览
npm run typecheck    # TS 类型检查
npm run lint         # ESLint
```

## 测试

### 1) 单元测试（Modal 行为一致性）

```bash
npm run test:unit
```

当前已覆盖：
- 点击遮罩关闭
- 点击关闭按钮关闭
- 标题与内容渲染

### 2) E2E（核心流程回归）

首次安装浏览器：

```bash
npm run test:e2e:install
```

运行前设置环境变量：

```bash
export E2E_EMAIL="your_email"
export E2E_PASSWORD="your_password"
export E2E_BASE_URL="http://127.0.0.1:5173" # 可选
```

执行测试：

```bash
npm run test:e2e
```

已覆盖主路径：登录 → 底部导航切页 → 首页弹窗打开/关闭（Esc + 点击遮罩）

## 目录说明

- `src/pages`：页面
- `src/components`：UI 与布局组件
- `src/lib`：Supabase、鉴权、Realtime、错误处理
- `src/stores`：Zustand 状态（业务状态 + Toast）
- `supabase/migrations`：数据库迁移

## 备注

- 该项目偏移动端体验，页面已锁定横向滑动，仅允许纵向滚动。
