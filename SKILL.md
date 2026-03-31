# TikTok Shop Skill

连接和控制 TikTok Shop 店铺的技能。支持 OAuth 2.0 授权、订单管理、商品管理等功能。

## 激活条件

当用户提到以下内容时激活此技能：
- TikTok Shop
- TikTok 店铺
- TikTok 订单
- TikTok 商品
- tiktok shop
- 抖店（国际版）

## 配置

在 `TOOLS.md` 中添加 TikTok Shop 配置：

```markdown
### TikTok Shop

- app_key: <你的应用 App Key>
- app_secret: <你的应用 App Secret>
- redirect_uri: https://your-domain.com/api/tiktok/oauth/callback
- access_token: <可选，已获取的访问令牌>
- refresh_token: <可选，刷新令牌>
- token_expires_at: <令牌过期时间>
- shop_id: <可选，默认店铺 ID>
```

## 命令

### 授权

```bash
openclaw tiktok-shop auth
```

生成授权 URL，用户点击后完成 OAuth 授权。

### 获取令牌

```bash
openclaw tiktok-shop token <authorization_code>
```

用授权码换取访问令牌。

### 刷新令牌

```bash
openclaw tiktok-shop refresh
```

刷新过期的访问令牌。

### 获取订单

```bash
openclaw tiktok-shop orders [--status <status>] [--limit <n>]
```

获取店铺订单列表。

### 获取订单详情

```bash
openclaw tiktok-shop order <order_id>
```

获取单个订单详情。

### 获取商品

```bash
openclaw tiktok-shop products [--status <status>] [--limit <n>]
```

获取商品列表。

### 获取商品详情

```bash
openclaw tiktok-shop product <product_id>
```

获取单个商品详情。

### 更新订单状态

```bash
openclaw tiktok-shop order <order_id> ship <tracking_number> [<carrier>]
```

标记订单为已发货。

## API 端点

技能需要以下 HTTP 端点来处理 OAuth 回调：

```
GET /api/tiktok/oauth/callback?code=xxx&state=xxx
```

这个端点需要：
1. 接收授权码
2. 调用 `/api/token/get` 换取访问令牌
3. 保存令牌到 TOOLS.md 或配置文件
4. 显示授权成功页面或重定向到应用

## 依赖

- Node.js 18+
- axios (HTTP 请求)
- crypto (签名计算)

## TikTok Shop API 文档

- 官方文档：https://partner.tiktokshop.com/docv2
- API 沙箱：https://partner.tiktokshop.com/docv2/page/sandbox
- OAuth 流程：https://partner.tiktokshop.com/docv2/doc/auth-process

## 注意事项

1. **HTTPS 强制**：所有 API 调用和重定向 URI 必须使用 HTTPS
2. **令牌安全**：access_token 和 app_secret 必须安全存储，不要提交到版本控制
3. **速率限制**：遵守 TikTok Shop API 的速率限制
4. **签名验证**：部分 API 需要请求签名（使用 app_secret）
5. **店铺授权**：一个应用可以授权多个店铺，需要管理 shop_id
