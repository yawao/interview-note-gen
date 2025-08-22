#!/bin/bash

# Interview Note Gen - ローカル起動スクリプト
# 使用方法: ./start-local.sh または bash start-local.sh

echo "🚀 Interview Note Gen - ローカル起動スクリプト"
echo "=================================="

# 環境チェック
echo "📋 環境チェック中..."

# Node.js のバージョンチェック
NODE_VERSION=$(node --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js がインストールされていません"
    echo "📥 https://nodejs.org/ からインストールしてください"
    exit 1
fi

# npm のバージョンチェック
NPM_VERSION=$(npm --version 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ npm: $NPM_VERSION"
else
    echo "❌ npm がインストールされていません"
    exit 1
fi

# .env.local ファイルの確認
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local ファイルが見つかりません"
    if [ -f ".env.local.example" ]; then
        echo "📋 .env.local.example から .env.local を作成します..."
        cp .env.local.example .env.local
        echo "✅ .env.local ファイルを作成しました"
        echo "⚠️  .env.local ファイルでOpenAI API キーを設定してください"
        echo "   OPENAI_API_KEY=your_openai_api_key_here"
        echo ""
        read -p "🔑 今すぐ設定しますか？ (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "OpenAI API キーを入力してください: " api_key
            if [ ! -z "$api_key" ]; then
                sed -i.bak "s/your_openai_api_key_here/$api_key/" .env.local
                echo "✅ API キーを設定しました"
            fi
        fi
    else
        echo "❌ .env.local.example ファイルも見つかりません"
        exit 1
    fi
fi

# OpenAI API キーの確認
if grep -q "your_openai_api_key_here" .env.local; then
    echo "⚠️  OpenAI API キーが設定されていません"
    echo "   .env.local ファイルでAPIキーを設定してください"
    echo ""
fi

# 依存関係のインストール
echo "📦 依存関係をチェック中..."
if [ ! -d "node_modules" ]; then
    echo "📥 依存関係をインストール中..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ npm install に失敗しました"
        exit 1
    fi
else
    echo "✅ 依存関係は既にインストール済みです"
fi

# Prisma の設定
echo "🗄️  データベースをセットアップ中..."
npx prisma generate > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Prisma クライアントを生成しました"
else
    echo "❌ Prisma クライアントの生成に失敗しました"
    exit 1
fi

npx prisma migrate dev --name init > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ データベースマイグレーションを実行しました"
else
    echo "✅ データベースは既に最新の状態です"
fi

# テストの実行（オプション）
echo ""
read -p "🧪 テストを実行しますか？ (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔍 基本テストを実行中..."
    npm run test:unit
    if [ $? -eq 0 ]; then
        echo "✅ テストが正常に完了しました"
    else
        echo "⚠️  一部のテストが失敗しましたが、アプリケーションは起動できます"
    fi
fi

# ポート3000の確認とクリア
echo "🔍 ポート3000をチェック中..."
PORT_3000_PIDS=$(lsof -ti:3000 2>/dev/null || true)
if [ ! -z "$PORT_3000_PIDS" ]; then
    echo "⚠️  ポート3000が使用中です。プロセスを終了します..."
    echo "   終了対象PID: $PORT_3000_PIDS"
    kill -9 $PORT_3000_PIDS 2>/dev/null || true
    sleep 2
    echo "✅ ポート3000をクリアしました"
fi

# 開発サーバーの起動
echo ""
echo "🎯 開発サーバーを起動中..."
echo "=================================="
echo "📍 アクセス先: http://localhost:3000"
echo ""
echo "💡 ヒント:"
echo "   - Ctrl+C でサーバーを停止"
echo "   - 'QUICKSTART.md' で詳細な使用方法を確認"
echo "   - 'tests/README.md' でテスト情報を確認"
echo ""
echo "🚀 起動中..."

# 開発サーバーを起動
npm run dev