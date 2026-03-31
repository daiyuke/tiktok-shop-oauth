#!/usr/bin/env node
/**
 * TikTok Shop OAuth 回调服务器
 * 
 * 接收 TikTok OAuth 授权回调，自动换取访问令牌
 */

import http from 'http';
import url from 'url';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// 配置
const PORT = process.env.TIKTOK_OAUTH_PORT || 3000;
const TOOLS_PATH = path.join(process.env.HOME || '~', '.openclaw', 'workspace', 'TOOLS.md');

interface TikTokConfig {
  app_key: string;
  app_secret: string;
  redirect_uri: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;
  shop_id?: string;
}

function loadConfig(): TikTokConfig {
  const toolsContent = fs.readFileSync(TOOLS_PATH, 'utf-8');
  const tiktokSection = toolsContent.match(/### TikTok Shop\s+([\s\S]*?)(?=###|$)/i);
  
  if (!tiktokSection) {
    throw new Error('未在 TOOLS.md 中找到 TikTok Shop 配置');
  }

  const config: any = {};
  const lines = tiktokSection[1].split('\n');
  
  for (const line of lines) {
    const match = line.match(/-?\s*(\w+):\s*(.+)/);
    if (match) {
      const [, key, value] = match;
      config[key.trim()] = value.trim();
    }
  }

  return config as TikTokConfig;
}

function saveConfig(config: Partial<TikTokConfig>): void {
  let toolsContent = fs.readFileSync(TOOLS_PATH, 'utf-8');
  
  for (const [key, value] of Object.entries(config)) {
    const regex = new RegExp(`(-\\s*${key}:\\s*).+`, 'i');
    if (toolsContent.match(regex)) {
      toolsContent = toolsContent.replace(regex, `$1${value}`);
    } else {
      const sectionMatch = toolsContent.match(/(### TikTok Shop\s+[\s\S]*?)(?=###|$)/i);
      if (sectionMatch) {
        toolsContent = toolsContent.replace(
          sectionMatch[1],
          `${sectionMatch[1]}- ${key}: ${value}\n`
        );
      }
    }
  }

  fs.writeFileSync(TOOLS_PATH, toolsContent);
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

async function exchangeToken(authCode: string, config: TikTokConfig): Promise<void> {
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
    });

    const { data } = response;
    
    if (data.code === 0) {
      const { access_token, refresh_token, access_token_expire_in, shop_id } = data.data;
      
      saveConfig({
        access_token,
        refresh_token,
        token_expires_at: Date.now() + access_token_expire_in * 1000,
        shop_id,
      });

      console.log('✅ 授权成功!');
      console.log(`店铺 ID: ${shop_id}`);
      console.log(`令牌过期时间：${new Date(Date.now() + access_token_expire_in * 1000).toLocaleString()}`);
      
      return; // 成功返回
    } else {
      console.error('❌ 获取令牌失败:', data.message);
      throw new Error(data.message);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('请求失败:', error.response?.data || error.message);
    }
    throw error;
  }
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url || '', true);
  
  // 只处理 OAuth 回调路径
  if (parsedUrl.pathname === '/api/tiktok/oauth/callback') {
    const { code, state, error } = parsedUrl.query;
    
    console.log(`[${new Date().toISOString()}] 收到回调请求`);
    console.log(`code: ${code ? code.substring(0, 10) + '...' : 'none'}`);
    console.log(`state: ${state}`);
    console.log(`error: ${error}`);

    if (error) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <head><title>授权失败</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ 授权失败</h1>
            <p>错误：${error}</p>
            <p>请返回应用重新尝试授权</p>
          </body>
        </html>
      `);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <head><title>缺少授权码</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ 缺少授权码</h1>
            <p>URL 中没有找到 code 参数</p>
          </body>
        </html>
      `);
      return;
    }

    try {
      const config = loadConfig();
      await exchangeToken(code as string, config);
      
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <head><title>授权成功</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #27ae60;">✅ 授权成功!</h1>
            <p>您的 TikTok Shop 已成功连接</p>
            <p>现在可以关闭此页面，返回应用继续使用</p>
            <script>
              setTimeout(() => { window.close(); }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <head><title>授权失败</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1 style="color: #e74c3c;">❌ 授权失败</h1>
            <p>${(error as Error).message}</p>
            <p>请检查配置后重新尝试</p>
          </body>
        </html>
      `);
    }
  } else {
    // 其他路径返回 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n\nTikTok Shop OAuth Server\nOnly /api/tiktok/oauth/callback is available');
  }
});

server.listen(PORT, () => {
  console.log('─'.repeat(60));
  console.log('TikTok Shop OAuth 回调服务器已启动');
  console.log('─'.repeat(60));
  console.log(`监听端口：${PORT}`);
  console.log(`回调地址：http://localhost:${PORT}/api/tiktok/oauth/callback`);
  console.log('');
  console.log('使用说明:');
  console.log('1. 在 TikTok 开发者后台将重定向 URI 设置为上述地址');
  console.log('2. 如果是公网访问，需要使用 ngrok 等工具暴露端口');
  console.log('3. 运行 tiktok-shop auth 生成授权链接');
  console.log('4. 在浏览器中打开授权链接完成授权');
  console.log('─'.repeat(60));
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});
