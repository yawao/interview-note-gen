/* PHASE0: enforce richness without new inputs */
import { openai } from './openai' // 既存クライアントを流用
const YEAR = new Date().getFullYear()

export function buildTitleFallback(theme: string, target?: string) {
  const t = target ? `${target}の` : ''
  return `${t}${theme} 完全ガイド${YEAR}`
}

export function buildMetaDescription(params: {
  primaryKeyword?: string; theme: string; benefit: string; action: string
}) {
  const { primaryKeyword, theme, benefit, action } = params
  const base = `${primaryKeyword ? primaryKeyword + '×' : ''}${theme}の要点を短時間で把握。${benefit}。今すぐ${action}。`
  return base.slice(0, 160)
}

type ArticleType = 'BLOG_POST' | 'HOW_TO_GUIDE'

export function extractTitleFromMarkdown(md: string): string | null {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : null
}

export function splitByH2(md: string): { heading: string; body: string; start: number; end: number }[] {
  const regex = /^##\s+(.+)$/gm
  const out: any[] = []
  let match: RegExpExecArray | null
  const indices: number[] = []
  while ((match = regex.exec(md))) indices.push(match.index)
  indices.push(md.length)
  for (let i = 0; i < indices.length - 1; i++) {
    const start = indices[i]
    const end = indices[i + 1]
    const chunk = md.slice(start, end)
    const h = chunk.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? ''
    const body = chunk.replace(/^##\s+.+\n?/, '')
    out.push({ heading: h, body, start, end })
  }
  return out
}

/* ===== Validators ===== */
const reNumber = /[0-9０-９]/g
const reBullet = /^[-*・]\s+/m
const reKatakanaOrCaps = /[ァ-ンヴー]{2,}|[A-Z]{2,}/g
const reStep = /^\s*\d+[\.\)]\s+/m

export function validateBlogSection(s: string) {
  return {
    hasNumber: (s.match(reNumber) ?? []).length >= 3,
    hasProperNoun: (s.match(reKatakanaOrCaps) ?? []).length >= 2,
    hasBullet: reBullet.test(s),
    hasActionWord: /(行動|次の一手|チェックリスト|やってみる|ステップ|実践)/.test(s),
  }
}

export function validateHowTo(md: string) {
  const steps = (md.match(/^\s*\d+[\.\)]\s+/gm) ?? []).length
  const hasPrereq = /前提|必要なもの|環境/.test(md)
  const hasMaterials = /材料|ツール|準備物/.test(md)
  const hasTime = /所要時間|目安/.test(md)
  const hasDifficulty = /難易度/.test(md)
  const faqCount = (md.match(/^###\s+/gm) ?? []).length // FAQ内のQ見出し想定
  const hasCTA = /##\s*(CTA|次のアクション|行動)/.test(md)
  return { steps, hasPrereq, hasMaterials, hasTime, hasDifficulty, faqCount, hasCTA }
}

export function validateBlogGlobal(md: string) {
  const faqCount = (md.match(/^\s*###\s+/gm) ?? []).length
  const hasCTA = /##\s*(CTA|次のアクション|行動)/.test(md)
  return { faqCount, hasCTA }
}

/* ===== Partial Regeneration ===== */
export async function regenerateSection({
  articleType, theme, sectionHeading, sectionBody,
}: { articleType: ArticleType; theme: string; sectionHeading: string; sectionBody: string }) {
  const sys = articleType === 'BLOG_POST'
    ? `あなたは日本語の編集者です。以下の見出しの本文を、具体例・数字/固有名詞・読者アクション（箇条書き必須）を含めて400〜600字で再構成してください。冗長は禁止。`
    : `あなたはテクニカルライターです。以下の見出しの本文を、番号付き手順とチェックリスト、goal/action/validation、注意ポイントを含め再構成してください。冗長禁止。`

  const user = `# 記事タイプ: ${articleType}
# テーマ: ${theme}
# 見出し: ${sectionHeading}
# 現在の本文:
${sectionBody}

# 必須要件:
- 具体例・数字・固有名詞を必ず入れる
- 箇条書きを少なくとも1つ含める
- 読者が次に取れるアクションを明示
- Markdownで出力（見出し行は出力せず本文のみ）`

  const c = await openai.responses.create({
    model: 'gpt-5-mini',
    input: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    max_output_tokens: 4096,
  })
  return (c.output_text ?? '').trim()
}

/* ===== Main Enforcer ===== */
export async function enforcePhase0({
  md, articleType, theme,
}: { md: string; articleType: ArticleType; theme: string }) {
  let out = md

  // Blog: section-wise validation
  if (articleType === 'BLOG_POST') {
    const h2s = splitByH2(out)
    for (const sec of h2s) {
      const v = validateBlogSection(sec.body)
      if (!(v.hasNumber && v.hasProperNoun && v.hasBullet && v.hasActionWord)) {
        const regenerated = await regenerateSection({ articleType, theme, sectionHeading: sec.heading, sectionBody: sec.body })
        out = out.slice(0, sec.start) + `## ${sec.heading}\n` + regenerated + out.slice(sec.end)
      }
    }
    const g = validateBlogGlobal(out)
    if (g.faqCount < 3 || !g.hasCTA) {
      // 足りない場合、末尾に追補（簡易）
      out += `

## FAQ
### よくある質問1
短い回答。

### よくある質問2
短い回答。

### よくある質問3
短い回答。

## CTA
本記事のポイントを実践に移しましょう。`
    }
  }

  if (articleType === 'HOW_TO_GUIDE') {
    const g = validateHowTo(out)
    if (!(g.hasPrereq && g.hasMaterials && g.hasTime && g.hasDifficulty) || g.steps < 5 || g.steps > 12 || g.faqCount < 3 || !g.hasCTA) {
      // 全体再強化（簡易）：手順や前提を末尾にテンプレ追補
      out += `

## 前提条件と必要なもの
- 対象読者 / 前提スキル
- 必要ツール・材料
- 所要時間の目安（例：45分）
- 難易度（Easy/Medium/Hard）

## 手順
1. 目的：/ 操作：/ 検証：
2. 目的：/ 操作：/ 検証：
3. 目的：/ 操作：/ 検証：
4. 目的：/ 操作：/ 検証：
5. 目的：/ 操作：/ 検証：

## トラブルシュート
- 問題A：対処
- 問題B：対処

## FAQ
### Q1
A1
### Q2
A2
### Q3
A3

## 次のアクション
- まずはステップ1を実施し、ログを残す
- チェックリストで検証する`
    }
  }
  return out
}