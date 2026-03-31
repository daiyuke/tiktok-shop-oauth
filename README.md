# TikTok Shop Skill

连接和控制 TikTok Shop 店铺的技能。

## 快速开始

### 1. 安装依赖

```bash
cd ~/.openclaw/workspace/skills/tiktok-shop
npm install
```

### 2. 配置 TOOLS.md

在 `~/.openclaw/workspace/TOOLS.md` 中添加：

```markdown
### TikTok Shop

- app_key: <你的应用 App Key>
- app_secret: <你的应用 App Secret>
- redirect_uri: https://your-domain.com/api/tiktok/oauth/callback
```

**获取 App Key 和 App Secret：**
1. 访问 https://partner.tiktokshop.com/
2. 登录并创建应用
3. 在应用设置中找到 App Key 和 App Secret

### 3. 设置重定向 URI

**本地开发（使用 ngrok）：**

```bash
# 安装 ngrok
npm install -g ngrok

# 启动 OAuth 服务器
npm start -- oauth-server

# 在另一个终端启动 ngrok
ngrok http 3000
```

ngrok 会给你一个 HTTPS 地址，如 `https://abc123.ngrok.io`

将这个地址作为重定向 URI：
- 在 TOOLS.md 中设置：`redirect_uri: https://abc123.ngrok.io/api/tiktok/oauth/callback`
- 在 TikTok 开发者后台的白名单中也添加这个地址

**云服务器：**

直接使用你的域名，如：
```
redirect_uri: https://your-server.com/api/tiktok/oauth/callback
```

### 4. 开始授权

```bash
# 生成授权链接
npm start -- auth

# 在浏览器中打开输出的链接，完成授权

# 授权完成后，服务器会自动换取令牌并保存
```

### 5. 使用命令

```bash
# 查看订单
npm start -- orders

# 查看待发货订单
npm start -- orders --status awaiting_shipment

# 查看订单详情
npm start -- order <order_id>

# 发货
npm start -- order <order_id> ship <tracking_number> <carrier>

# 查看商品
npm start -- products

# 查看商品详情
npm start -- product <product_id>

# 刷新令牌
npm start -- refresh
```

## 命令参考

| 命令 | 说明 |
|-----|------|
| `auth` | 生成授权 URL |
| `token <code>` | 用授权码换取令牌 |
| `refresh` | 刷新访问令牌 |
| `orders [--status <s>] [--limit <n>]` | 获取订单列表 |
| `order <id>` | 获取订单详情 |
| `order <id> ship <tracking> [carrier]` | 标记订单为已发货 |
| `products [--status <s>] [--limit <n>]` | 获取商品列表 |
| `product <id>` | 获取商品详情 |

## 订单状态

- `unpaid` - 未支付
- `awaiting_shipment` - 待发货
- `awaiting_collection` - 待揽收
- `in_transit` - 运输中
- `completed` - 已完成
- `cancelled` - 已取消

## 商品状态

- `draft` - 草稿
- `pending` - 审核中
- `active` - 在售
- `inactive` - 下架
- `deleted` - 已删除

## OAuth 回调服务器

启动 OAuth 回调服务器（用于自动处理授权回调）：

```bash
npm start -- oauth-server
```

默认监听 3000 端口，可通过环境变量修改：

```bash
TIKTOK_OAUTH_PORT=8080 npm start -- oauth-server
```

## 安全注意事项

1. **不要提交敏感信息** - `app_secret`、`access_token`、`refresh_token` 不应提交到版本控制
2. **使用 HTTPS** - 所有 API 调用和重定向 URI 必须使用 HTTPS
3. **定期刷新令牌** - 访问令牌会过期，使用 `refresh` 命令刷新
4. **限制访问** - OAuth 服务器不应暴露在公网，除非必要

## 故障排除

### 授权失败

- 检查重定向 URI 是否在 TikTok 后台白名单中
- 确保使用 HTTPS
- 检查 app_key 和 app_secret 是否正确

### 令牌过期

运行 `refresh` 命令刷新令牌。如果 refresh_token 也过期了，需要重新授权。

### API 请求失败

- 检查网络连接
- 确认 access_token 有效
- 查看 TikTok Shop API 文档确认端点是否正确

## 相关文档

- [TikTok Shop API 文档](https://partner.tiktokshop.com/docv2)
- [OAuth 授权流程](https://partner.tiktokshop.com/docv2/doc/auth-process)
- [API 沙箱](https://partner.tiktokshop.com/docv2/page/sandbox)
