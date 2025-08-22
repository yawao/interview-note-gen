# 🚀 Interview Note Gen - ローカル起動ガイド

## 前提条件

- Node.js 18.x または 20.x
- npm (Node.js に付属)
- OpenAI API キー

## セットアップ手順

### 1. リポジトリのクローン（または既存プロジェクトに移動）

```bash
cd /Users/jitsugen/Documents/interview-note-gen-PRJ
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

```bash
# 環境設定ファイルをコピー
cp .env.local.example .env.local

# エディタで .env.local を開いて OpenAI API キーを設定
# OPENAI_API_KEY=your_openai_api_key_here
```

**重要**: `.env.local` ファイルに実際の OpenAI API キーを設定してください。

### 4. データベースのセットアップ

```bash
# Prisma クライアントを生成
npx prisma generate

# データベースマイグレーションを実行
npx prisma migrate dev --name init
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

🎉 **完了！** ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 🧪 テストの実行

### 基本テスト

```bash
# 単体テスト (核心要件のテスト)
npm run test:unit

# スナップショットテスト (回帰防止)
npm run test:snapshots

# プロパティテスト (不変条件検証)
npm run test:property

# 全回帰テスト
npm run test:regression
```

### カバレッジテスト

```bash
# カバレッジレポート生成
npm run test:coverage

# カバレッジ閾値チェック (90%以上)
npm run test:coverage:check
```

### パフォーマンス・セキュリティテスト

```bash
# パフォーマンステスト
npm run test:performance

# セキュリティテスト (注入攻撃耐性)
npm run test:security
```

## 🎯 アプリケーションの使用方法

### 基本ワークフロー

1. **プロジェクト作成**
   - トップページで「新しいインタビュープロジェクト」を作成
   - テーマとインタビュー対象者の情報を入力

2. **質問生成**
   - AI が関連する質問を自動生成（5-7問）
   - 手動で質問を編集・追加可能

3. **音声録音**
   - ブラウザ内蔵の録音機能を使用
   - MediaRecorder API による高品質録音

4. **自動転写**
   - OpenAI Whisper による音声→テキスト変換
   - 日本語・英語両対応

5. **構造化分析**
   - **根拠付き回答抽出**: トランスクリプトに基づく回答のみ
   - **自動埋め防止**: 根拠のない項目は `未回答` として処理
   - **項目数固定**: 質問数と回答項目数の厳密一致

6. **記事生成**
   - AI による構造化された記事作成
   - Markdown 形式でのダウンロード

## 🔧 トラブルシューティング

### よくある問題

**1. Port 3000 が使用中**
```bash
# ポート3000をクリア
npm run kill-port

# または手動でクリア
bash scripts/kill-port-3000.sh

# クリア後に起動
npm run dev:clean
```

**2. データベースエラー**
```bash
# データベースリセット
npx prisma migrate reset
npx prisma generate
```

**3. OpenAI API エラー**
- `.env.local` ファイルで API キーを確認
- API キーの権限・残高を確認

**4. 依存関係の問題**
```bash
# node_modules クリア
rm -rf node_modules package-lock.json
npm install
```

### テスト失敗時の対応

**スナップショット更新**
```bash
npm run test:snapshots -- --update
```

**詳細デバッグ**
```bash
# ウォッチモードでテスト
npm run test:watch

# UIモードでインタラクティブデバッグ
npm run test:ui
```

## 📁 プロジェクト構造

```
interview-note-gen-PRJ/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API エンドポイント
│   │   └── page.tsx        # メインページ
│   ├── components/         # React コンポーネント
│   ├── lib/               # ユーティリティ・ビジネスロジック
│   └── types/             # TypeScript 型定義
├── tests/                 # 包括的テストスイート
│   ├── fixtures/         # テストデータ
│   ├── helpers/          # テストヘルパー
│   └── *.spec.ts         # テストファイル
├── prisma/               # データベーススキーマ
└── .env.local.example    # 環境変数テンプレート
```

## 🎯 核心機能の確認

### 要件1: 根拠なし自動埋め防止

```bash
# この要件をテスト
npm run test:unit -- --grep "根拠なし"
```

### 要件2: 出力項目数制御

```bash
# この要件をテスト  
npm run test:unit -- --grep "項目数"
```

## 📞 サポート

問題が発生した場合:

1. この QUICKSTART.md のトラブルシューティングを確認
2. `tests/README.md` で詳細なテスト情報を確認
3. GitHub Issues で問題を報告

---

**Happy Coding! 🎉**