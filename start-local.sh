#!/bin/bash

# インタビュー記事生成システム - ローカル起動スクリプト

echo "🚀 インタビュー記事生成システム起動中..."

# 環境変数ファイルの確認
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local ファイルが見つかりません"
    echo "📝 .env.local.template をコピーして .env.local を作成し、OpenAI API Keyを設定してください"
    exit 1
fi

# OpenAI API Keyの確認
if ! grep -q "OPENAI_API_KEY=.*sk-" .env.local; then
    echo "⚠️  OpenAI API Key が設定されていない可能性があります"
    echo "📝 .env.local ファイルでOPENAI_API_KEYを正しく設定してください"
fi

# 依存関係のインストール確認
if [ ! -d "node_modules" ]; then
    echo "📦 依存関係をインストール中..."
    npm install
fi

# Prismaクライアントの生成
echo "🗄️  データベースを準備中..."
npx prisma generate > /dev/null 2>&1
npx prisma db push > /dev/null 2>&1

echo "✅ セットアップ完了"
echo ""
echo "🌐 アプリケーションを起動しています..."
echo "📍 ブラウザで以下のURLにアクセスしてください："
echo "   http://localhost:3000"
echo ""
echo "⏹️  停止するには Ctrl+C を押してください"
echo ""

# 開発サーバーの起動
npm run dev