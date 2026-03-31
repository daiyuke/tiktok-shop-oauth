# 部署到 Render 完整指南

## 步骤 1: 准备代码

### 方式 A: 使用 GitHub（推荐）

```bash
# 在技能目录初始化 git 仓库
cd ~/.openclaw/workspace/skills/tiktok-shop

# 初始化 git（如果 workspace 已经有仓库则跳过）
git init

# 创建 .gitignore
cat > .gitignore << 'EOF'
node_modules
config.json
*.log
.env
EOF

# 添加文件
git add -A
git commit -m "TikTok Shop OAuth Server for Render"

# 创建 GitHub 仓库并推送
# 访问 https://github.com/new 创建新仓库
# 然后：
git remote add origin https://github.com/YOUR_USERNAME/tiktok-shop-oauth.git
git branch -M main
git push -u origin main
```

### 方式 B: 直接上传

也可以直接下载整个 `tiktok-shop` 文件夹，然后手动上传到 Render。

---

## 步骤 2: 在 Render 创建服务

### 2.1 登录 Render

访问 https://render.com 并登录（可以用 GitHub 账号）

### 2.2 创建新服务

1. 点击 **"New +"** → **"Web Service"**
2. 选择连接方式：
   - **Connect GitHub repo**: 选择你刚创建的仓库
   - **Deploy from Git URL**: 粘贴 GitHub 仓库地址

### 2.3 配置服务

| 配置项 | 值 |
|-------|-----|
| **Name** | `tiktok-shop-oauth`（或其他你喜欢的名字） |
| **Region** | Oregon（俄勒冈，离亚洲较近） |
| **Branch** | `main` |
| **Root Directory** | 留空（或填 `skills/tiktok-shop` 如果是整个 workspace） |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npx tsx render-server.ts` |
| **Instance Type** | `Free` |

### 2.4 配置环境变量

点击 **"Advanced"** → **"Add Environment Variable"**，添加以下变量：

| Key | Value |
|-----|-------|
| `TIKTOK_APP_KEY` | 从 TikTok 开发者后台获取 |
| `TIKTOK_APP_SECRET` | 从 TikTok 开发者后台获取 |
| `TIKTOK_REDIRECT_URI` | `https://<你的 render 域名>/api/tiktok/oauth/callback` |
| `NODE_ENV` | `production` |
| `CONFIG_PATH` | `/opt/render/project/src/config.json` |

⚠️ **注意**: `TIKTOK_REDIRECT_URI` 的域名需要等你部署后才能知道，可以先留空，部署后再更新。

### 2.5 配置持久化磁盘（可选但推荐）

Render 免费版有临时文件系统，重启后数据会丢失。为了保存令牌，需要配置磁盘：

在 `render.yaml` 中已经包含了磁盘配置，如果你使用 YAML 部署：

```yaml
disk:
  name: tiktok-config
  mountPath: /opt/render/project/src
  sizeGB: 1
```

或者在 Web 界面：
1. 点击 **"Disks"** 标签
2. **"Add Disk"**
3. Name: `tiktok-config`
4. Mount Path: `/opt/render/project/src`
5. Size: `1 GB`

### 2.6 创建服务

点击 **"Create Web Service"**

---

## 步骤 3: 获取部署后的域名

服务创建后，Render 会给你一个域名，格式如：

```
https://tiktok-shop-oauth-abc123.onrender.com
```

### 3.1 更新重定向 URI

1. 复制你的 Render 域名
2. 在 Render 后台，进入服务 → **"Environment"**
3. 更新 `TIKTOK_REDIRECT_URI` 为：
   ```
   https://tiktok-shop-oauth-abc123.onrender.com/api/tiktok/oauth/callback
   ```
4. 点击 **"Save Changes"**

### 3.2 在 TikTok 后台配置白名单

1. 访问 https://partner.tiktokshop.com/
2. 进入你的应用设置
3. 找到 **"Redirect URI"** 或 **"OAuth 配置"**
4. 添加你的 Render 回调地址：
   ```
   https://tiktok-shop-oauth-abc123.onrender.com/api/tiktok/oauth/callback
   ```
5. 保存

---

## 步骤 4: 完成授权

### 4.1 访问状态页面

在浏览器打开你的 Render 服务首页：
```
https://tiktok-shop-oauth-abc123.onrender.com
```

你会看到状态页面，显示：
- 服务器配置状态
- 授权状态
- 令牌信息

### 4.2 点击授权按钮

如果配置正确，页面会有一个 **"开始授权"** 按钮，点击它。

### 4.3 在 TikTok 完成授权

1. 跳转到 TikTok 授权页面
2. 登录你的 TikTok Shop 账号
3. 点击 **"Authorize"** 或 **"授权"**
4. 授权完成后会自动跳转回你的 Render 服务

### 4.4 确认授权成功

跳转回来后，状态页面应该显示：
- ✅ 已授权
- 店铺 ID
- 令牌过期时间

---

## 步骤 5: 使用 API

授权完成后，你可以通过 API 访问 TikTok Shop 数据。

### 健康检查

```bash
curl https://tiktok-shop-oauth-abc123.onrender.com/health
```

### 获取状态

```bash
curl https://tiktok-shop-oauth-abc123.onrender.com/api/status
```

### 刷新令牌

```bash
curl -X POST https://tiktok-shop-oauth-abc123.onrender.com/api/refresh
```

---

## 步骤 6: 集成到 OpenClaw

现在你可以在 OpenClaw 中使用这个服务了。

### 更新 TOOLS.md

```markdown
### TikTok Shop

- app_key: <你的 App Key>
- app_secret: <你的 App Secret>
- redirect_uri: https://tiktok-shop-oauth-abc123.onrender.com/api/tiktok/oauth/callback
- access_token: <从 Render 服务获取>
- refresh_token: <从 Render 服务获取>
- shop_id: <你的店铺 ID>
- oauth_server: https://tiktok-shop-oauth-abc123.onrender.com
```

### 使用 CLI

```bash
cd ~/.openclaw/workspace/skills/tiktok-shop

# 查看订单
npx tsx tiktok-shop.ts orders

# 查看商品
npx tsx tiktok-shop.ts products
```

---

## 常见问题

### 服务进入休眠

Render 免费版服务 15 分钟无请求会进入休眠，下次请求需要 30-60 秒唤醒。

**解决方案：**
- 使用 [UptimeRobot](https://uptimerobot.com/) 免费监控，每 5 分钟 ping 一次 `/health` 端点
- 或升级到付费计划

### 配置丢失

如果重启后配置丢失，检查：
1. 磁盘是否正确挂载
2. `CONFIG_PATH` 环境变量是否正确
3. 磁盘是否有写入权限

### 授权失败

检查：
1. Redirect URI 是否在 TikTok 后台白名单中
2. Redirect URI 是否完全匹配（包括 `https://` 和路径）
3. App Key 和 App Secret 是否正确

### 令牌过期

访问 `/api/refresh` 端点或点击状态页面的 **"刷新令牌"** 按钮。

---

## 升级建议

当你的业务增长后，考虑：

1. **升级到 Render 付费计划** - 避免休眠，更高性能
2. **添加自定义域名** - 更专业，更稳定
3. **添加日志和监控** - 使用 Render 的日志功能
4. **实现完整的 API 代理** - 在 Render 服务器上实现所有 TikTok API 调用

---

## 费用

- **Render 免费版**: $0/月（有休眠，适合测试）
- **Render 基础版**: $7/月（无休眠，适合生产）
- **TikTok Shop API**: 免费（遵守速率限制）
