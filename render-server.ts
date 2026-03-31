#!/usr/bin/env node
/**
 * TikTok Shop OAuth Server for Render
 * 
 * 部署到 Render 的 OAuth 回调服务器
 * 支持环境变量配置
 */

import http from 'http';
import url from 'url';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// 配置 - 优先使用环境变量
const PORT = parseInt(process.env.PORT || '3000', 10);
const APP_KEY = process.env.TIKTOK_APP_KEY;
const APP_SECRET = process.env.TIKTOK_APP_SECRET;
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

// 可选：配置存储路径（Render 有持久化磁盘时使用）
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');

interface TikTokConfig {
  app_key: string;
  app_secret: string;
  redirect_uri: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;
  shop_id?: string;
}

interface StoredConfig {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;
  shop_id?: string;
}

function loadStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('加载配置失败:', (error as Error).message);
  }
  return {};
}

function saveStoredConfig(config: StoredConfig): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('配置已保存');
  } catch (error) {
    console.error('保存配置失败:', (error as Error).message);
  }
}

function calculateSign(params: Record<string, any>, secret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys
    .map(key => `${key}${params[key]}`)
    .join('') + secret;

  return crypto
    .createHash('sha256')
    .update(signString)
    .digest('hex')
    .toUpperCase();
}

async function exchangeToken(authCode: string, config: { app_key: string; app_secret: string; redirect_uri: string }): Promise<{ success: boolean; message: string; data?: any }> {
  const API_BASE = 'https://open-api.tiktokglobalshop.com';
  const API_VERSION = '202309';
  
  const url = `${API_BASE}/api/${API_VERSION}/token/get`;
  
  const params = {
    app_key: config.app_key,
    auth_code: authCode,
    grant_type: 'authorized_code',
    redirect_uri: config.redirect_uri,
  };

  const sign = calculateSign(params, config.app_secret);

  try {
    const response = await axios.post(url, null, {
      params: { ...params, sign },
      timeout: 10000,
    });

    const { data } = response;
    
    if (data.code === 0) {
      const { access_token, refresh_token, access_token_expire_in, shop_id } = data.data;
      
      // 保存令牌
      saveStoredConfig({
        access_token,
        refresh_token,
        token_expires_at: Date.now() + access_token_expire_in * 1000,
        shop_id,
      });

      return {
        success: true,
        message: '授权成功',
        data: { shop_id, expires_at: new Date(Date.now() + access_token_expire_in * 1000).toLocaleString() }
      };
    } else {
      return {
        success: false,
        message: data.message || '获取令牌失败'
      };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
    return {
      success: false,
      message: (error as Error).message
    };
  }
}

async function refreshToken(config: { app_key: string; app_secret: string; redirect_uri: string }, storedConfig: StoredConfig): Promise<{ success: boolean; message: string; data?: any }> {
  if (!storedConfig.refresh_token) {
    return {
      success: false,
      message: '没有找到 refresh_token'
    };
  }

  const API_BASE = 'https://open-api.tiktokglobalshop.com';
  const API_VERSION = '202309';
  
  const url = `${API_BASE}/api/${API_VERSION}/token/refresh`;
  
  const params = {
    app_key: config.app_key,
    grant_type: 'refresh_token',
    refresh_token: storedConfig.refresh_token,
  };

  const sign = calculateSign(params, config.app_secret);

  try {
    const response = await axios.post(url, null, {
      params: { ...params, sign },
      timeout: 10000,
    });

    const { data } = response;
    
    if (data.code === 0) {
      const { access_token, refresh_token, access_token_expire_in } = data.data;
      
      saveStoredConfig({
        ...storedConfig,
        access_token,
        refresh_token,
        token_expires_at: Date.now() + access_token_expire_in * 1000,
      });

      return {
        success: true,
        message: '令牌刷新成功',
        data: { expires_at: new Date(Date.now() + access_token_expire_in * 1000).toLocaleString() }
      };
    } else {
      return {
        success: false,
        message: data.message || '刷新令牌失败'
      };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        message: error.response?.data?.message || error.message
      };
    }
    return {
      success: false,
      message: (error as Error).message
    };
  }
}

// HTML 模板
const styles = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { 
      font-size: 24px; 
      margin-bottom: 20px;
      text-align: center;
    }
    .success { color: #27ae60; }
    .error { color: #e74c3c; }
    .info { color: #3498db; }
    p { margin-bottom: 15px; line-height: 1.6; color: #555; }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      margin-top: 10px;
      transition: background 0.3s;
    }
    .btn:hover { background: #5a6fd6; }
    .code {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      overflow-x: auto;
      margin: 15px 0;
    }
    .status {
      padding: 10px 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .status.success { background: #d4edda; color: #155724; }
    .status.error { background: #f8d7da; color: #721c24; }
  </style>
`;

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname;
  
  // API: 健康检查
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // API: 刷新令牌
  if (pathname === '/api/refresh' && req.method === 'POST') {
    if (!APP_KEY || !APP_SECRET || !REDIRECT_URI) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '服务器配置不完整' }));
      return;
    }

    const result = await refreshToken(
      { app_key: APP_KEY, app_secret: APP_SECRET, redirect_uri: REDIRECT_URI },
      loadStoredConfig()
    );

    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: 获取当前配置状态
  if (pathname === '/api/status' && req.method === 'GET') {
    const stored = loadStoredConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      configured: !!(APP_KEY && APP_SECRET && REDIRECT_URI),
      authorized: !!stored.access_token,
      shop_id: stored.shop_id,
      token_expires_at: stored.token_expires_at 
        ? new Date(stored.token_expires_at).toISOString() 
        : null
    }));
    return;
  }

  // OAuth 回调
  if (pathname === '/api/tiktok/oauth/callback') {
    const { code, state, error } = parsedUrl.query;
    
    console.log(`[${new Date().toISOString()}] 收到回调请求`);
    console.log(`code: ${code ? code.substring(0, 10) + '...' : 'none'}`);
    console.log(`error: ${error}`);

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><title>授权失败</title>${styles}</head><body>
        <div class="container">
          <h1 class="error">❌ 授权失败</h1>
          <div class="status error">错误：${error}</div>
          <p>请返回应用重新尝试授权</p>
        </div>
      </body></html>`);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><title>缺少授权码</title>${styles}</head><body>
        <div class="container">
          <h1 class="error">❌ 缺少授权码</h1>
          <p>URL 中没有找到 code 参数</p>
        </div>
      </body></html>`);
      return;
    }

    if (!APP_KEY || !APP_SECRET || !REDIRECT_URI) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><title>服务器未配置</title>${styles}</head><body>
        <div class="container">
          <h1 class="error">❌ 服务器配置不完整</h1>
          <p>缺少必要的环境变量：TIKTOK_APP_KEY, TIKTOK_APP_SECRET, TIKTOK_REDIRECT_URI</p>
          <p>请在 Render 后台配置这些环境变量</p>
        </div>
      </body></html>`);
      return;
    }

    const result = await exchangeToken(code as string, {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      redirect_uri: REDIRECT_URI,
    });

    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><title>授权成功</title>${styles}</head><body>
        <div class="container">
          <h1 class="success">✅ 授权成功!</h1>
          <div class="status success">店铺 ID: ${result.data?.shop_id || '未知'}</div>
          <p>令牌过期时间：${result.data?.expires_at || '未知'}</p>
          <p>您的 TikTok Shop 已成功连接</p>
          <p style="margin-top: 20px;">
            <a href="/" class="btn">查看状态</a>
          </p>
        </div>
      </body></html>`);
    } else {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html><head><title>授权失败</title>${styles}</head><body>
        <div class="container">
          <h1 class="error">❌ 授权失败</h1>
          <div class="status error">${result.message}</div>
          <p>请检查配置后重新尝试</p>
        </div>
      </body></html>`);
    }
    return;
  }

  // 首页 - 状态页面
  if (pathname === '/') {
    const stored = loadStoredConfig();
    const isConfigured = !!(APP_KEY && APP_SECRET && REDIRECT_URI);
    const isAuthorized = !!stored.access_token;
    const expiresAt = stored.token_expires_at ? new Date(stored.token_expires_at).toLocaleString('zh-CN') : null;
    const isExpired = stored.token_expires_at && Date.now() > stored.token_expires_at;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><title>TikTok Shop OAuth Server</title>${styles}</head><body>
      <div class="container">
        <h1 class="info">🔧 TikTok Shop OAuth Server</h1>
        
        <h3 style="margin: 20px 0 10px;">服务器配置</h3>
        <div class="status ${isConfigured ? 'success' : 'error'}">
          ${isConfigured ? '✅ 已配置' : '❌ 未配置'}
        </div>
        ${!isConfigured ? '<p>请在 Render 后台配置环境变量：TIKTOK_APP_KEY, TIKTOK_APP_SECRET, TIKTOK_REDIRECT_URI</p>' : ''}
        
        <h3 style="margin: 20px 0 10px;">授权状态</h3>
        <div class="status ${isAuthorized && !isExpired ? 'success' : isExpired ? 'error' : 'info'}">
          ${isAuthorized ? (isExpired ? '⚠️ 令牌已过期' : '✅ 已授权') : '⏳ 未授权'}
        </div>
        ${isAuthorized ? `<p>店铺 ID: ${stored.shop_id || '未知'}</p>` : ''}
        ${expiresAt ? `<p>令牌过期时间：${expiresAt}</p>` : ''}
        
        ${isExpired ? '<p style="margin-top: 15px;"><a href="/api/refresh" class="btn" onclick="fetch(\'/api/refresh\',{method:\'POST\'}).then(r=>r.json()).then(d=>location.reload());return false;">刷新令牌</a></p>' : ''}
        ${!isAuthorized && isConfigured ? `<p style="margin-top: 15px;"><a href="https://partner.tiktokshop.com/oauthv2/authorize?app_key=${APP_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${crypto.randomBytes(16).toString('hex')}" class="btn" target="_blank">开始授权</a></p>` : ''}
        
        <h3 style="margin: 20px 0 10px;">API 端点</h3>
        <div class="code">
          GET  /health                    - 健康检查<br>
          GET  /api/status                - 获取状态<br>
          POST /api/refresh               - 刷新令牌<br>
          GET  /api/tiktok/oauth/callback - OAuth 回调
        </div>
        
        <p style="margin-top: 20px; font-size: 12px; color: #999;">
          TikTok Shop OAuth Server v1.0 | Deployed on Render
        </p>
      </div>
    </body></html>`);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('─'.repeat(60));
  console.log('TikTok Shop OAuth Server (Render 版本)');
  console.log('─'.repeat(60));
  console.log(`监听端口：${PORT}`);
  console.log(`环境变量检查:`);
  console.log(`  TIKTOK_APP_KEY: ${APP_KEY ? '✅' : '❌'}`);
  console.log(`  TIKTOK_APP_SECRET: ${APP_SECRET ? '✅' : '❌'}`);
  console.log(`  TIKTOK_REDIRECT_URI: ${REDIRECT_URI ? '✅' : '❌'}`);
  console.log('─'.repeat(60));
});
