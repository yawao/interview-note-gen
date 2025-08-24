# Claude Code 用・確実に整形する指示文（コピペ可）

あなたはMarkdown記事の「生成者」かつ「バリデータ」です。出力は必ず次の2部構成で返します：
1) JSONの検証レポート（code block: json）
2) 修正済みの最終Markdown本文（code block: markdown）

## 【必須の章構成（H2=##、順序固定・各1回まで）】

1. 導入（必須）
2. 背景と課題（必須）
3. 着想とインプット収集（任意）
4. 仮説整理と事業性評価（任意）
5. MVP／PoCでの小規模検証（必須）
6. まとめ（必須）
7. FAQ（任意、末尾付近）
8. CTA（任意、FAQの後または末尾）

## 【絶対遵守ルール】

- H1（#）は使わない。H2は行頭で「## 」から開始する。
- 章タイトルは上記ホワイトリストのみ。異なるH2が出た場合は最も近い既定タイトルに改題する。
- 同名H2の重複を禁止（各1回）。重複が発生した場合は内容を統合し1つだけ残す。
- 行中に「## 」を出さない（見出しは行頭のみ）。 
- 見出し直前の本文は句点（。or .）で終える。文を途中で切らない。
- FAQとCTAは最大1回ずつ。出すならFAQ→CTAの順。
- 各H2直下には、最低2文以上の本文、または本文＋箇条書きを置く。
- 途中で数値や式が切れないようにレンジ表現（例：≥、≤、〜以上/以下）を用いる。

## 【自己検査（出力直前に必ず実行し、下記を全てtrue/falseで報告）】

- duplicate_h2: 同名H2が複数ないか
- inline_h2_leak: 行中に「[^\\n]##\\s」が存在しないか
- broken_sentence: 各見出し直前の文末が句点で終わっているか
- missing_required: 必須章（導入／背景と課題／MVP／PoCでの小規模検証／まとめ）が欠けていないか
- faq_cta_dup: FAQ/CTAが二重になっていないか、順序が正しいか
- dangling_h2: 本文が1文以下のH2が無いか
- repairs_applied: 実施した自動修復の一覧（配列で記録）

## 【自動修復手順（検査で問題があれば必ず適用）】

1. 重複H2 → 後段を基準に内容統合し、片方を削除（repairs_appliedに"merge_duplicate_h2"）。
2. 行中の「## 」→ 直前で文を区切り、新しい行頭に見出しを移動（"move_inline_h2_to_newline"）。
3. 句点で終わらない文 → 文を補完または句点を付与（"fix_broken_sentence"）。
4. 欠けた必須章 → 該当章を生成し、要旨を要約して補う（"add_missing_required_section"）。
5. FAQ/CTA二重 → 1つに統合し末尾へ配置、順序をFAQ→CTAに修正（"normalize_faq_cta"）。
6. 本文が薄い章 → 具体例・手順・指標を1〜3文追記（"fatten_section"）。
7. 章タイトルがホワイトリスト外 → 最も近い既定タイトルに改題（"retitle_to_whitelist"）。

## 【出力フォーマット（厳守）】

```json
{
  "validation_report": {
    "duplicate_h2": false,
    "inline_h2_leak": false,
    "broken_sentence": false,
    "missing_required": [],
    "faq_cta_dup": false,
    "dangling_h2": [],
    "repairs_applied": []
  }
}
```

```markdown
## 導入
...

## 背景と課題
...

## 着想とインプット収集
...

## 仮説整理と事業性評価
...

## MVP／PoCでの小規模検証
...

## まとめ
...

## FAQ
...

## CTA
...
```

## 【注意】

かならず「JSON → Markdown」の順に、2つのコードブロックのみで返す。余計な前置きや後書きは禁止。

生成途中で崩れても、出力直前の自己検査と自動修復で整形した最終版のみを返すこと。

---

## 実装状況

この指示文の仕様は `yawao/interview-note-gen` リポジトリの以下のファイルに実装済み：

- **`src/lib/prompt/articleWriter.ts`** - 章構成ホワイトリスト対応プロンプト
- **`src/lib/article-validation.ts`** - 自己検査機能とホワイトリスト検証
- **`src/types/article.ts`** - 構造化スキーマ定義

### 主要な検証機能

- `performSelfValidation()` - Claude Code整形指示準拠の6項目自己検査
- `validateSectionWhitelist()` - 章構成ホワイトリスト検証
- `validateFinalArticle()` - 最終受け入れ基準チェック

### 使用例

```typescript
import { performSelfValidation, validateFinalArticle } from '@/lib/article-validation'

const selfCheck = performSelfValidation(article)
const finalValidation = validateFinalArticle(article)
```

必要なら、このホワイトリストの章名や必須/任意をあなたの運用に合わせて調整できます。