#!/bin/bash

# ポート3000を使用中のプロセスを強制終了するスクリプト

echo "🔍 ポート3000を使用中のプロセスをチェック中..."

# ポート3000を使用中のプロセスIDを取得
PIDS=$(lsof -ti:3000 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "✅ ポート3000は使用されていません"
    exit 0
fi

echo "⚠️  ポート3000を使用中のプロセスが見つかりました:"
echo "   PID: $PIDS"

# プロセス詳細を表示
echo ""
echo "📋 プロセス詳細:"
lsof -n -i:3000 2>/dev/null || true

echo ""
read -p "🗑️  これらのプロセスを終了しますか？ (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🛑 プロセスを終了中..."
    
    # まずは優雅に終了を試みる (SIGTERM)
    for pid in $PIDS; do
        echo "   SIGTERM → PID:$pid"
        kill $pid 2>/dev/null || true
    done
    
    # 2秒待つ
    sleep 2
    
    # まだ残っているプロセスを強制終了 (SIGKILL)
    REMAINING_PIDS=$(lsof -ti:3000 2>/dev/null)
    if [ ! -z "$REMAINING_PIDS" ]; then
        echo "   強制終了中..."
        for pid in $REMAINING_PIDS; do
            echo "   SIGKILL → PID:$pid"
            kill -9 $pid 2>/dev/null || true
        done
    fi
    
    # 最終確認
    sleep 1
    FINAL_CHECK=$(lsof -ti:3000 2>/dev/null)
    if [ -z "$FINAL_CHECK" ]; then
        echo "✅ ポート3000をクリアしました"
    else
        echo "❌ 一部のプロセスが残っています: $FINAL_CHECK"
        echo "   手動で確認してください: lsof -i:3000"
    fi
else
    echo "❌ キャンセルしました"
    exit 1
fi