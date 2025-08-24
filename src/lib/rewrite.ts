// 記事構成リライト機能
// 重複見出し・途中で切れた文・FAQ/CTAの多重出力など体裁崩れを防止
import { openai } from '@/lib/openai'

export async function rewriteStructure({
  md,
  articleType = 'BLOG_POST' as 'BLOG_POST' | 'HOW_TO_GUIDE',
}: { md: string; articleType?: 'BLOG_POST' | 'HOW_TO_GUIDE' }) {
  const sys = `あなたは日本語の編集者です。以下のMarkdown記事を構成面だけリライトします。`
  const user = `
# 目的
- 見出しの重複を削除し、章順を「導入→背景と課題→事例/分析→示唆→まとめ→FAQ→CTA」に整理
- 途中で途切れている文を文脈で補修（内容は創作しない）
- 同一テーマの重複段落を統合
- FAQとCTAは末尾に1回のみ
- Markdown体裁（## 見出し → 本文 → 箇条書き）を整える
- 数値や主張は変更しない（構成と体裁のみ調整）

# 入力
[ARTICLE_TYPE]: ${articleType}
[MARKDOWN]:
${md}

# 出力要件
- Markdownのみを返す（前置き・説明なし）
- 章順は「導入→背景と課題→事例/分析→示唆→まとめ→FAQ→CTA」
- FAQ, CTA は1回のみ
`
  const res = await openai.responses.create({
    model: 'gpt-5-mini',
    input: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    max_output_tokens: 8000,
  })
  return (res.output_text ?? '').trim()
}