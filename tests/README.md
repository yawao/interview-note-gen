# Interview Note Generation - 包括的テストスイート

## 概要

このテストスイートは、interview-note-gen の2つの核心要件に対する回帰防止を目的として設計されています：

1. **要件1**: 根拠なし自動埋め防止 - answered項目は必ずevidenceを持つ
2. **要件2**: 出力項目数制御 - 質問数Nに対して厳密にN項目を出力

## テスト構成

### 1. 包括的テスト (`tests/interviewNoteGen.spec.ts`)

核心機能の網羅的テスト：
- 根拠なし項目のunanswered変換
- 偽の根拠検出・除外
- 注入攻撃耐性
- overflow/underflow防止
- エッジケース処理

### 2. スナップショットテスト (`tests/snapshots.spec.ts`)

回帰検出のための基準値記録：
- 基本シナリオの出力構造
- Overflow正規化の動作
- Evidence-downshift処理
- 決定性の確認

### 3. プロパティベーステスト (`tests/property.spec.ts`)

fast-checkによる11の不変プロパティ検証：
- 出力項目数の一致性
- answered項目の根拠必須
- unanswered項目の一貫性
- 攻撃耐性

### 4. テストヘルパー (`tests/helpers/llmStub.ts`)

決定的なLLMスタブ実装：

```typescript
type LLMStubMode = 
  | 'normal'           // 正常：質問数ちょうど、answered は evidence あり
  | 'over'             // 超過：質問数+1件を返す  
  | 'under'            // 不足：質問数-1件しか返さない
  | 'answeredNoEvidence' // evidence欠落
  | 'nonJSON'          // JSON前後に文章付き
  | 'fakeEvidence'     // 偽引用：transcriptに存在しない
  | 'injection'        // 注入影響：すべて回答しようとする
  | 'fuzzy'            // ファジー（プロパティテスト用）
```

### 5. テストフィクスチャ (`tests/fixtures/`)

- `questions.basic.json` - 基本的な3質問
- `questions.hundred.json` - 100質問（大量処理テスト）
- `questions.overflow.json` - overflow制御用
- `transcript.basic.txt` - 基本トランスクリプト
- `transcript.long.txt` - 長文トランスクリプト
- `transcript.injection.txt` - 注入攻撃パターン
- `i18n.ja.txt` - 日本語対応確認

## 実行方法

### 個別テスト実行

```bash
# 包括的テスト
npm run test:unit

# スナップショットテスト
npm run test:snapshots

# プロパティテスト
npm run test:property

# 回帰テスト（全テスト）
npm run test:regression
```

### 特定観点のテスト

```bash
# パフォーマンステスト
npm run test:performance

# セキュリティテスト
npm run test:security

# カバレッジ確認
npm run test:coverage
```

### カバレッジ要件

- Statements: 90%以上
- Branches: 85%以上  
- Functions: 90%以上
- Lines: 90%以上

```bash
npm run test:coverage:check
```

## CI/CD統合

GitHub Actionsワークフロー (`.github/workflows/test.yml`) により：

1. **マルチNode.js環境テスト** (18.x, 20.x)
2. **段階的テスト実行**：lint → typecheck → unit → integration → property → snapshots
3. **回帰テスト検証**：核心要件の自動確認
4. **パフォーマンステスト**：100問処理の性能確認
5. **セキュリティテスト**：注入攻撃耐性確認

## テスト設計原則

### 1. 決定性
- シード固定による再現可能なLLMスタブ
- 同一入力で同一出力の保証

### 2. 包括性
- 正常系・異常系・エッジケースの網羅
- 15パターンの系統的テストケース

### 3. 回帰防止
- スナップショットによる出力構造の固定
- プロパティテストによる不変条件の検証

### 4. 攻撃耐性
- プロンプトインジェクション対策
- 偽の根拠検出・除外

## トラブルシューティング

### テスト失敗時の対応

1. **スナップショット不一致**
```bash
npm run test:snapshots -- --update
```

2. **プロパティテスト失敗**
```bash
# シード値を確認して再現
npm run test:property -- --reporter=verbose
```

3. **カバレッジ不足**
```bash
npm run test:coverage -- --reporter=html
open coverage/index.html
```

### デバッグ実行

```bash
# ウォッチモードでテスト開発
npm run test:watch

# UIモードでインタラクティブデバッグ  
npm run test:ui
```

## 継続的改善

### テスト追加時の注意点

1. **新機能追加時**：対応するテストケースの追加
2. **バグ修正時**：回帰防止テストの追加
3. **パフォーマンス改善時**：ベンチマークテストの更新

### 定期的な見直し

- 月次：カバレッジ要件の見直し
- 四半期：テストケースの有効性評価
- 半年：プロパティテストの追加・更新