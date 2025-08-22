# インタビュー記事生成システム - ローカル起動手順

## 概要
AI Responses APIを利用したインタビュー記事自動生成システムです。音声転写、質問生成、記事作成を一元管理できます。

## システム要件
- Node.js 18.0 以上
- npm または yarn
- OpenAI API Key（gpt-5-mini対応）

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
`.env.local` ファイルで以下の設定を確認・更新してください：

```bash
# Database
DATABASE_URL="file:./dev.db"

# OpenAI API Key（必須）
OPENAI_API_KEY="your-openai-api-key-here"

# Supabase（本番用・開発時は不要）
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**重要**: OpenAI API Keyは必ず設定してください。gpt-5-miniモデルへのアクセス権限が必要です。

### 3. データベースのセットアップ
```bash
# Prismaクライアントの生成
npx prisma generate

# データベースの同期（初回のみ）
npx prisma db push
```

### 4. 開発サーバーの起動
```bash
npm run dev
```

アプリケーションは http://localhost:3000 で起動します。

## 主な機能
- **プロジェクト管理**: インタビューテーマと対象者の設定
- **質問生成**: AIによる自動質問生成
- **音声転写**: OpenAI Whisperによる音声ファイル文字起こし
- **記事生成**: 長文回答（800-1000文字）から高品質記事の自動生成
- **複数形式対応**: Blog記事、How-toガイド

## 技術スタック
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: SQLite（開発）/ Supabase（本番）
- **AI**: OpenAI Responses API (gpt-5-mini)
- **ORM**: Prisma

## 最新の改善点
✅ **Responses API対応**: 従来の空白レスポンス問題を完全解決  
✅ **長文処理最適化**: 800-1000文字の詳細回答から高品質記事生成  
✅ **トークン効率化**: max_output_tokens 16000で安定動作  
✅ **エラーハンドリング**: 堅牢な長文処理システム

## トラブルシューティング

### よくある問題と解決策

**1. OpenAI API エラー**
```
Error: OpenAI API Key が設定されていません
```
→ `.env.local` ファイルで `OPENAI_API_KEY` を正しく設定してください

**2. データベース接続エラー**
```
Error: Prisma Client 初期化エラー
```
→ 以下を実行してください：
```bash
npx prisma generate
npx prisma db push
```

**3. ポート衝突**
```
Error: Port 3000 is already in use
```
→ 他のプロセスでport 3000が使用中です。プロセスを終了するか、別のポートを使用してください：
```bash
npm run dev -- -p 3001
```

**4. 依存関係エラー**
```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install
```

## 開発・テスト

### テストファイルの実行
長文回答テスト:
```bash
node test-800-1000-article.js
```

パフォーマンステスト:
```bash
node test-performance-comparison.js
```

### データベース管理
```bash
# データベースブラウザでの確認
npx prisma studio

# マイグレーションの作成
npx prisma migrate dev --name your_migration_name
```

## API エンドポイント
- `POST /api/questions` - AI質問生成
- `POST /api/transcribe` - 音声転写
- `POST /api/draft` - 記事生成
- `GET /api/projects` - プロジェクト一覧
- `GET /api/articles/[id]` - 記事取得

## サポート
- 技術的な問題: システムログとエラーメッセージを確認
- OpenAI API: 利用制限とクォータの確認
- Prisma: データベーススキーマの整合性確認