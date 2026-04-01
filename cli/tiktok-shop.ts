#!/usr/bin/env node
/**
 * TikTok Shop CLI
 * 
 * 连接和控制 TikTok Shop 店铺的命令行工具
 */

import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// TikTok Shop API 基础 URL
const API_BASE = 'https://open-api.tiktokglobalshop.com';
const API_VERSION = '202309';

// 配置文件路径
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

interface Order {
  order_id: string;
  order_status: number;
  create_time: number;
  update_time: number;
  buyer_message: string;
  recipient_address: RecipientAddress;
  line_items: LineItem[];
  payment_info: PaymentInfo;
  tracking_info?: TrackingInfo;
}

interface RecipientAddress {
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  zip_code: string;
}

interface LineItem {
  product_id: string;
  sku_id: string;
  product_name: string;
  sku_name: string;
  quantity: number;
  sale_price: number;
  original_price: number;
}

interface PaymentInfo {
  currency: string;
  total_amount: number;
  shipping_fee: number;
  tax: number;
}

interface TrackingInfo {
  tracking_number: string;
  carrier: string;
  ship_time: number;
}

interface Product {
  product_id: string;
  title: string;
  description: string;
  status: number;
  create_time: number;
  update_time: number;
  skus: Sku[];
  images: string[];
  categories: Category[];
}

interface Sku {
  sku_id: string;
  sku_name: string;
  price: number;
  stock: number;
  seller_sku: string;
}

interface Category {
  category_id: string;
  category_name: string;
}

class TikTokShopCLI {
  private config: TikTokConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): TikTokConfig {
    try {
      const toolsContent = fs.readFileSync(TOOLS_PATH, 'utf-8');
      
      // 解析 TOOLS.md 中的 TikTok Shop 配置
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

      if (!config.app_key || !config.app_secret || !config.redirect_uri) {
        throw new Error('配置不完整：需要 app_key, app_secret, redirect_uri');
      }

      return config as TikTokConfig;
    } catch (error) {
      console.error('加载配置失败:', (error as Error).message);
      process.exit(1);
    }
  }

  private saveConfig(config: Partial<TikTokConfig>): void {
    try {
      let toolsContent = fs.readFileSync(TOOLS_PATH, 'utf-8');
      
      // 更新配置项
      for (const [key, value] of Object.entries(config)) {
        const regex = new RegExp(`(-\\s*${key}:\\s*).+`, 'i');
        if (toolsContent.match(regex)) {
          toolsContent = toolsContent.replace(regex, `$1${value}`);
        } else {
          // 在 TikTok Shop 部分添加新配置
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
      console.log('配置已保存');
    } catch (error) {
      console.error('保存配置失败:', (error as Error).message);
    }
  }

  /**
   * 生成授权 URL
   */
  generateAuthUrl(state?: string): string {
    const randomState = state || crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      app_key: this.config.app_key,
      redirect_uri: this.config.redirect_uri,
      state: randomState,
    });

    return `https://partner.tiktokshop.com/oauthv2/authorize?${params.toString()}`;
  }

  /**
   * 用授权码换取访问令牌
   */
  async getToken(authCode: string): Promise<void> {
    const url = `${API_BASE}/api/${API_VERSION}/token/get`;
    
    const params = {
      app_key: this.config.app_key,
      auth_code: authCode,
      grant_type: 'authorized_code',
      redirect_uri: this.config.redirect_uri,
    };

    const sign = this.calculateSign(params, this.config.app_secret);

    try {
      const response = await axios.post(url, null, {
        params: { ...params, sign },
      });

      const { data } = response;
      
      if (data.code === 0) {
        const { access_token, refresh_token, access_token_expire_in, shop_id } = data.data;
        
        console.log('✅ 授权成功!');
        console.log(`店铺 ID: ${shop_id}`);
        console.log(`令牌过期时间：${new Date(Date.now() + access_token_expire_in * 1000).toLocaleString()}`);

        // 保存令牌
        this.saveConfig({
          access_token,
          refresh_token,
          token_expires_at: Date.now() + access_token_expire_in * 1000,
          shop_id,
        });
      } else {
        console.error('❌ 获取令牌失败:', data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('请求失败:', error.response?.data || error.message);
      } else {
        console.error('错误:', error);
      }
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(): Promise<void> {
    if (!this.config.refresh_token) {
      console.error('❌ 没有找到 refresh_token，请先完成授权');
      return;
    }

    const url = `${API_BASE}/api/${API_VERSION}/token/refresh`;
    
    const params = {
      app_key: this.config.app_key,
      grant_type: 'refresh_token',
      refresh_token: this.config.refresh_token,
    };

    const sign = this.calculateSign(params, this.config.app_secret);

    try {
      const response = await axios.post(url, null, {
        params: { ...params, sign },
      });

      const { data } = response;
      
      if (data.code === 0) {
        const { access_token, refresh_token, access_token_expire_in } = data.data;
        
        console.log('✅ 令牌刷新成功!');
        console.log(`新令牌过期时间：${new Date(Date.now() + access_token_expire_in * 1000).toLocaleString()}`);

        this.saveConfig({
          access_token,
          refresh_token,
          token_expires_at: Date.now() + access_token_expire_in * 1000,
        });
      } else {
        console.error('❌ 刷新令牌失败:', data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('请求失败:', error.response?.data || error.message);
      } else {
        console.error('错误:', error);
      }
    }
  }

  /**
   * 获取订单列表
   */
  async getOrders(options: { status?: string; limit?: number } = {}): Promise<void> {
    await this.ensureToken();

    const url = `${API_BASE}/api/${API_VERSION}/orders/search`;
    
    const params: any = {
      page_size: options.limit || 20,
      page: 1,
    };

    if (options.status) {
      params.order_status = this.parseOrderStatus(options.status);
    }

    try {
      const response = await axios.post(url, params, {
        headers: {
          'Access-Token': this.config.access_token,
        },
      });

      const { data } = response;
      
      if (data.code === 0) {
        const { orders, total } = data.data;
        console.log(`共 ${total} 个订单，显示 ${orders.length} 个:`);
        console.log('─'.repeat(80));
        
        for (const order of orders) {
          this.printOrder(order);
        }
      } else {
        console.error('❌ 获取订单失败:', data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('请求失败:', error.response?.data || error.message);
      } else {
        console.error('错误:', error);
      }
    }
  }

  /**
   * 获取订单详情
   */
  async getOrder(orderId: string): Promise<void> {
    await this.ensureToken();

    const url = `${API_BASE}/api/${API_VERSION}/orders/${orderId}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Access-Token': this.config.access_token,
        },
      });

      const { data } = response;
      
      if (data.code === 0) {
        console.log('订单详情:');
        console.log('─'.repeat(80));
        this.printOrder(data.data, true);
      } else {
        console.error('❌ 获取订单详情失败:', data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('请求失败:', error.response?.data || error.message);
      } else {
        console.error('错误:', error);
      }
    }
  }

  /**
   * 获取商品列表
   */
  async getProducts(options: { status?: string; limit?: number } = {}): Promise<void> {
    await this.ensureToken();

    const url = `${API_BASE}/api/${API_VERSION}/products/search`;
    
    const params: any = {
      page_size: options.limit || 20,
      page: 1,
    };

    if (options.status) {
      params.status = this.parseProductStatus(options.status);
    }

    try {
      const response = await axios.post(url, params, {
        headers: {
          'Access-Token': this.config.access_token,
        },
      });

      const { data } = response;
      
      if (data.code === 0) {
        const { products, total } = data.data;
        console.log(`共 ${total} 个商品，显示 ${products.length} 个:`);
        console.log('─'.repeat(80));
        
        for (const product of products) {
          this.printProduct(product);
        }
      } else {
        console.error('❌ 获取商品失败:', data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('请求失败:', error.response?.data || error.message);
      } else {
        console.error('错误:', error);
      }
    }
  }

  /**
   * 获取商品详情
   */
  async getProduct(productId: string): Promise<void> {
    await this.ensureToken();

    const url = `${API_BASE}/api/${API_VERSION}/products/${productId}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Access-Token': this.config.access_token,
        },
      });

      const { data } = response;
      
      if (data.code === 0) {
        console.log('商品详情:');
        console.log('─'.repeat(80));
        this.printProduct(data.data, true);
      } else {
        console.error('❌ 获取商品详情失败:', data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('请求失败:', error.response?.data || error.message);
      } else {
        console.error('错误:', error);
      }
    }
  }

  /**
   * 标记订单为已发货
   */
  async shipOrder(orderId: string, trackingNumber: string, carrier?: string): Promise<void> {
    await this.ensureToken();

    const url = `${API_BASE}/api/${API_VERSION}/packages/ship`;
    
    const params = {
      order_id: orderId,
      tracking_number: trackingNumber,
      carrier: carrier || '',
    };

    try {
      const response = await axios.post(url, params, {
        headers: {
          'Access-Token': this.config.access_token,
        },
      });

      const { data } = response;
      
      if (data.code === 0) {
        console.log('✅ 订单已标记为已发货');
        console.log(`运单号：${trackingNumber}`);
        if (carrier) {
          console.log(`物流商：${carrier}`);
        }
      } else {
        console.error('❌ 发货失败:', data.message);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('请求失败:', error.response?.data || error.message);
      } else {
        console.error('错误:', error);
      }
    }
  }

  /**
   * 计算 API 请求签名
   */
  private calculateSign(params: Record<string, any>, secret: string): string {
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

  /**
   * 确保有有效的访问令牌
   */
  private async ensureToken(): Promise<void> {
    if (!this.config.access_token) {
      console.error('❌ 未找到 access_token，请先运行 auth 命令完成授权');
      process.exit(1);
    }

    if (this.config.token_expires_at && Date.now() > this.config.token_expires_at - 60000) {
      console.log('⚠️  令牌即将过期，尝试刷新...');
      await this.refreshToken();
    }
  }

  /**
   * 解析订单状态字符串
   */
  private parseOrderStatus(status: string): number {
    const statusMap: Record<string, number> = {
      'unpaid': 1,
      'awaiting_shipment': 2,
      'awaiting_collection': 3,
      'in_transit': 4,
      'completed': 5,
      'cancelled': 6,
    };
    return statusMap[status.toLowerCase()] || 0;
  }

  /**
   * 解析商品状态字符串
   */
  private parseProductStatus(status: string): number {
    const statusMap: Record<string, number> = {
      'draft': 0,
      'pending': 1,
      'active': 2,
      'inactive': 3,
      'deleted': 4,
    };
    return statusMap[status.toLowerCase()] || 0;
  }

  /**
   * 打印订单信息
   */
  private printOrder(order: Order, detailed = false): void {
    console.log(`订单 ID: ${order.order_id}`);
    console.log(`状态：${order.order_status}`);
    console.log(`创建时间：${new Date(order.create_time * 1000).toLocaleString()}`);
    console.log(`金额：${order.payment_info?.total_amount || 0} ${order.payment_info?.currency || ''}`);
    
    if (detailed) {
      console.log(`买家留言：${order.buyer_message || '无'}`);
      console.log(`收货地址：${order.recipient_address?.address_line1}, ${order.recipient_address?.city}, ${order.recipient_address?.country}`);
      console.log('商品明细:');
      order.line_items?.forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.product_name} (${item.sku_name}) x${item.quantity} - ${item.sale_price}`);
      });
      
      if (order.tracking_info) {
        console.log(`物流：${order.tracking_info.carrier} - ${order.tracking_info.tracking_number}`);
      }
    }
    console.log('─'.repeat(80));
  }

  /**
   * 打印商品信息
   */
  private printProduct(product: Product, detailed = false): void {
    console.log(`商品 ID: ${product.product_id}`);
    console.log(`标题：${product.title}`);
    console.log(`状态：${product.status}`);
    
    if (detailed) {
      console.log(`描述：${product.description || '无'}`);
      console.log('SKU 列表:');
      product.skus?.forEach((sku, i) => {
        console.log(`  ${i + 1}. ${sku.sku_name} - 价格：${sku.price}, 库存：${sku.stock}`);
      });
      console.log(`图片：${product.images?.length || 0} 张`);
    }
    console.log('─'.repeat(80));
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    console.log(`
TikTok Shop CLI - 连接和控制 TikTok Shop 店铺

用法: tiktok-shop <command> [options]

命令:
  auth                    生成授权 URL
  token <auth_code>       用授权码换取访问令牌
  refresh                 刷新访问令牌
  orders [options]        获取订单列表
  order <order_id>        获取订单详情
  order <order_id> ship <tracking_number> [carrier]  标记订单为已发货
  products [options]      获取商品列表
  product <product_id>    获取商品详情
  help                    显示帮助信息

选项:
  --status <status>       按状态筛选 (orders: unpaid/awaiting_shipment/completed/cancelled)
  --limit <n>             限制返回数量 (默认 20)

示例:
  tiktok-shop auth
  tiktok-shop token abc123xyz
  tiktok-shop orders --status awaiting_shipment --limit 10
  tiktok-shop order ORD123456 ship SF123456789 SF-Express
`);
  }

  /**
   * 运行 CLI
   */
  run(args: string[]): void {
    const command = args[0];

    switch (command) {
      case 'auth':
        const authUrl = this.generateAuthUrl();
        console.log('请在浏览器中打开以下链接完成授权:');
        console.log('─'.repeat(80));
        console.log(authUrl);
        console.log('─'.repeat(80));
        console.log('\n授权完成后，复制 URL 中的 auth_code 参数，运行:');
        console.log(`tiktok-shop token <auth_code>`);
        break;

      case 'token':
        if (!args[1]) {
          console.error('❌ 请提供授权码: tiktok-shop token <auth_code>');
          process.exit(1);
        }
        this.getToken(args[1]);
        break;

      case 'refresh':
        this.refreshToken();
        break;

      case 'orders': {
        const options: { status?: string; limit?: number } = {};
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--status' && args[i + 1]) {
            options.status = args[++i];
          } else if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[++i], 10);
          }
        }
        this.getOrders(options);
        break;
      }

      case 'order':
        if (!args[1]) {
          console.error('❌ 请提供订单 ID: tiktok-shop order <order_id>');
          process.exit(1);
        }
        if (args[2] === 'ship') {
          if (!args[3]) {
            console.error('❌ 请提供运单号: tiktok-shop order <order_id> ship <tracking_number> [carrier]');
            process.exit(1);
          }
          this.shipOrder(args[1], args[3], args[4]);
        } else {
          this.getOrder(args[1]);
        }
        break;

      case 'products': {
        const options: { status?: string; limit?: number } = {};
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--status' && args[i + 1]) {
            options.status = args[++i];
          } else if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[++i], 10);
          }
        }
        this.getProducts(options);
        break;
      }

      case 'product':
        if (!args[1]) {
          console.error('❌ 请提供商品 ID: tiktok-shop product <product_id>');
          process.exit(1);
        }
        this.getProduct(args[1]);
        break;

      case 'help':
      default:
        this.showHelp();
    }
  }
}

// 主程序
const cli = new TikTokShopCLI();
cli.run(process.argv.slice(2));
