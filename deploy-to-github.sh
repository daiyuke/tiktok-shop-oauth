#!/bin/bash
# TikTok Shop OAuth - 推送到 GitHub 部署脚本

set -e

echo "============================================================"
echo "TikTok Shop OAuth - 推送到 GitHub"
echo "============================================================"
echo ""

# 检查 Git 是否安装
if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装，请先安装 Git"
    exit 1
fi

# 进入项目目录
cd "$(dirname "$0")"

echo "📁 当前目录：$(pwd)"
echo ""

# 检查是否已经有远程仓库
if git remote -v | grep -q origin; then
    echo "⚠️  已经配置了远程仓库:"
    git remote -v
    echo ""
    read -p "是否要移除现有远程仓库并重新配置？(y/N): " confirm
    if [[ $confirm == [yY] ]]; then
        git remote remove origin
        echo "✅ 已移除现有远程仓库"
    else
        echo "跳过远程仓库配置"
    fi
fi

echo ""
echo "请输入你的 GitHub 用户名:"
read -p "> " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ GitHub 用户名不能为空"
    exit 1
fi

REPO_NAME="tiktok-shop-oauth"
REMOTE_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo ""
echo "📦 仓库地址：${REMOTE_URL}"
echo ""

# 检查 Git 用户配置
if [ -z "$(git config user.name)" ]; then
    echo "⚠️  未配置 Git 用户名"
    read -p "请输入 Git 用户名: " GIT_NAME
    git config --global user.name "$GIT_NAME"
fi

if [ -z "$(git config user.email)" ]; then
    echo "⚠️  未配置 Git 邮箱"
    read -p "请输入 Git 邮箱: " GIT_EMAIL
    git config --global user.email "$GIT_EMAIL"
fi

echo ""
echo "🔧 初始化 Git 仓库..."

# 初始化仓库（如果还没有）
if [ ! -d ".git" ]; then
    git init
    echo "✅ Git 仓库已初始化"
else
    echo "✅ Git 仓库已存在"
fi

echo ""
echo "📝 添加文件..."
git add -A
echo "✅ 文件已添加"

echo ""
echo "💾 提交更改..."
git commit -m "Initial commit: TikTok Shop OAuth Server for Render" || echo "✅ 没有新更改需要提交"

echo ""
echo "🔄 重命名分支为 main..."
git branch -M main 2>/dev/null || echo "✅ 分支已是 main"

echo ""
echo "🔗 添加远程仓库..."
git remote add origin "$REMOTE_URL" 2>/dev/null || {
    echo "⚠️  远程仓库已存在，更新 URL..."
    git remote set-url origin "$REMOTE_URL"
}
echo "✅ 远程仓库已配置：${REMOTE_URL}"

echo ""
echo "============================================================"
echo "📤 准备推送到 GitHub"
echo "============================================================"
echo ""
echo "下一步操作:"
echo ""
echo "1. 在 GitHub 创建新仓库:"
echo "   https://github.com/new"
echo ""
echo "   - Repository name: ${REPO_NAME}"
echo "   - 选择 Public 或 Private"
echo "   - 不要勾选 'Add a README file'"
echo "   - 点击 'Create repository'"
echo ""
echo "2. 创建完成后，运行以下命令推送:"
echo ""
echo "   git push -u origin main"
echo ""
echo "3. 推送时如果需要密码，使用 Personal Access Token:"
echo "   https://github.com/settings/tokens"
echo ""
echo "============================================================"
echo ""

# 询问是否立即推送
read -p "是否现在推送？(确保已在 GitHub 创建仓库) (y/N): " confirm_push

if [[ $confirm_push == [yY] ]]; then
    echo ""
    echo "📤 推送到 GitHub..."
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "============================================================"
        echo "✅ 推送成功!"
        echo "============================================================"
        echo ""
        echo "仓库地址：https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
        echo ""
        echo "下一步：前往 Render 部署"
        echo "https://render.com"
        echo ""
    else
        echo ""
        echo "❌ 推送失败，请检查:"
        echo "   1. 是否已在 GitHub 创建仓库"
        echo "   2. 用户名是否正确"
        echo "   3. 是否使用了正确的 Personal Access Token"
        echo ""
    fi
else
    echo ""
    echo "⏭️  跳过推送"
    echo ""
    echo "稍后手动运行:"
    echo "  git push -u origin main"
    echo ""
fi
