// Bパス（読み物記事）専用プロンプト定義
// Aパスと同等の厳格な構造ガード（JSON I/O + 検証 + サニタイズ）を適用

import { structuredArticleSchema } from '@/types/article'

/**
 * Bパス System プロンプト
 * 記事構造の厳格化と見出し混入防止を厳命
 */
export const articleSystemPrompt = `あなたはプロの編集者です。インタビュー素材から読み物記事を作成します。以下を厳守してください：

CRITICAL CONSTRAINTS:
- 出力はJSONのみ。Markdownやテキスト記号は一切使用禁止
- sectionsは必ず3-5個（範囲外は不合格）
- 重複するh2見出しは絶対禁止（意味が重なる場合は統合する）
- body内に見出し記号（#, ##, ###, H1:, H2:等）を含めない
- 文途中で章を切り替えない（途切れ禁止）
- 推測で未回答を補完しない（必要なら「この点は未回答」と明示）

FORBIDDEN ACTIONS (絶対禁止):
- Markdownの見出し記号（#, ##, ###）の出力
- body内での見出し形式（H1:, H2-1, ■見出し■等）の使用
- 同一または類似のh2見出しの重複作成
- 文章の途中での見出し開始（例: 「ROIが## まとめ」）
- JSON以外の前置き・後置き文章
- 推測による内容の水増しや創作

OUTPUT FORMAT:
- 厳密なJSONスキーマに従う（StructuredArticle）
- title: 30-40文字の魅力的なタイトル
- lead: 3-4文の記事概要（読者メリット明示）
- sections: 3-5個のセクション（各400-600文字推奨）
- faq: オプション（質問と回答のペア）
- cta: オプション（行動喚起）

STRUCTURE RULES:
1. sectionsの各bodyは完結した内容にする
2. h2は読者が理解しやすい見出しにする
3. 各セクションは独立して読める構成にする
4. 数字・データ・具体例を積極的に活用する
5. 専門用語は分かりやすく説明する`

/**
 * Bパス User プロンプト
 * ペイロード処理とスキーマ準拠の指示
 */
export const articleUserPrompt = `次の素材から、上記スキーマに従う構造化記事(JSON)を出力してください。
素材の長い回答から要点を抽出し、読者に価値を提供する記事に再構成してください。

出力は以下JSONスキーマに厳密準拠：

{
  "type": "object",
  "properties": {
    "title": {"type": "string", "minLength": 10, "maxLength": 60},
    "lead": {"type": "string", "minLength": 50, "maxLength": 300},
    "sections": {
      "type": "array",
      "minItems": 3,
      "maxItems": 5,
      "items": {
        "type": "object", 
        "properties": {
          "h2": {"type": "string", "minLength": 5, "maxLength": 50},
          "body": {"type": "string", "minLength": 200, "maxLength": 800}
        },
        "required": ["h2", "body"]
      }
    },
    "faq": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "q": {"type": "string"},
          "a": {"type": "string"}
        },
        "required": ["q", "a"]
      }
    },
    "cta": {"type": "string"}
  },
  "required": ["title", "lead", "sections"]
}

PROCESSING RULES:
1. blocksでhasEvidence=falseの項目は「この点は未回答でした」等で処理
2. blocksでhasEvidence=trueの項目を中心に各セクションを構成
3. contextは補助情報として参照可能（主役はblocks）
4. 読者にとって実践的で価値のある内容に再構成
5. 長い回答は要点を抽出して構造化

品質要件:
- 各セクションは独立して価値がある内容
- 見出しは読者が一目で内容を理解できる表現
- 具体例・数字・データを含める（可能な場合）
- 読みやすく、actionableな内容にする

入力データ：`

/**
 * レスポンス構造検証（AパスのvalidateResponseStructure相当）
 */
export function validateArticleStructure(response: any): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!response || typeof response !== 'object') {
    errors.push('Response is not an object')
    return { isValid: false, errors, warnings }
  }
  
  // Required fields validation
  if (typeof response.title !== 'string') {
    errors.push('title is not a string')
  } else if (response.title.length < 10 || response.title.length > 60) {
    warnings.push(`title length (${response.title.length}) is outside recommended range (10-60)`)
  }
  
  if (typeof response.lead !== 'string') {
    errors.push('lead is not a string')
  } else if (response.lead.length < 50 || response.lead.length > 300) {
    warnings.push(`lead length (${response.lead.length}) is outside recommended range (50-300)`)
  }
  
  if (!Array.isArray(response.sections)) {
    errors.push('sections is not an array')
    return { isValid: false, errors, warnings }
  }
  
  if (response.sections.length < 3 || response.sections.length > 5) {
    errors.push(`sections count (${response.sections.length}) must be between 3-5`)
  }
  
  // Section validation
  const h2Set = new Set<string>()
  for (let i = 0; i < response.sections.length; i++) {
    const section = response.sections[i]
    
    if (typeof section.h2 !== 'string') {
      errors.push(`sections[${i}].h2 is not a string`)
    } else {
      // Duplicate h2 check
      const normalizedH2 = section.h2.toLowerCase().trim()
      if (h2Set.has(normalizedH2)) {
        errors.push(`Duplicate h2 found: "${section.h2}"`)
      } else {
        h2Set.add(normalizedH2)
      }
      
      // Heading contamination check
      if (section.h2.includes('#') || section.h2.includes('H1:') || section.h2.includes('H2:')) {
        errors.push(`sections[${i}].h2 contains forbidden heading symbols`)
      }
    }
    
    if (typeof section.body !== 'string') {
      errors.push(`sections[${i}].body is not a string`)
    } else {
      // Body content validation
      if (section.body.length < 100) {
        warnings.push(`sections[${i}].body is very short (${section.body.length} chars)`)
      }
      
      // Heading contamination in body
      if (section.body.includes('\n##') || section.body.includes('\n#') || 
          section.body.includes('H2:') || section.body.includes('■')) {
        errors.push(`sections[${i}].body contains forbidden heading symbols`)
      }
      
      // Truncation detection
      const truncationPatterns = [
        /…で。##/,
        /ROIシ##/,
        /外注はC##/,
        /AR##/,
        /途中で切れた文##/
      ]
      
      for (const pattern of truncationPatterns) {
        if (pattern.test(section.body)) {
          errors.push(`sections[${i}].body appears to be truncated: contains suspicious pattern`)
        }
      }
    }
  }
  
  // FAQ validation (if present)
  if (response.faq && Array.isArray(response.faq)) {
    for (let i = 0; i < response.faq.length; i++) {
      const faq = response.faq[i]
      if (typeof faq.q !== 'string') {
        errors.push(`faq[${i}].q is not a string`)
      }
      if (typeof faq.a !== 'string') {
        errors.push(`faq[${i}].a is not a string`)
      }
    }
  }
  
  // CTA validation (if present)
  if (response.cta && typeof response.cta !== 'string') {
    errors.push('cta is not a string')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 記事品質の詳細分析（崩れ検出）
 */
export function analyzeArticleQuality(article: any): {
  structureScore: number
  contentRichness: number 
  readabilityScore: number
  issues: {
    duplicateH2: string[]
    badHeadings: string[]
    truncations: string[]
    shortSections: string[]
  }
} {
  const issues = {
    duplicateH2: [] as string[],
    badHeadings: [] as string[],
    truncations: [] as string[],
    shortSections: [] as string[]
  }
  
  let structureScore = 100
  let contentRichness = 0
  let readabilityScore = 0
  
  if (!article.sections || !Array.isArray(article.sections)) {
    return { structureScore: 0, contentRichness: 0, readabilityScore: 0, issues }
  }
  
  // H2 duplicate analysis
  const h2Map = new Map<string, number>()
  article.sections.forEach((section: any, index: number) => {
    if (section.h2) {
      const normalized = section.h2.toLowerCase().trim()
      const count = h2Map.get(normalized) || 0
      h2Map.set(normalized, count + 1)
      
      if (count > 0) {
        issues.duplicateH2.push(`"${section.h2}" (section ${index + 1})`)
        structureScore -= 25
      }
    }
  })
  
  // Content analysis
  let totalWords = 0
  let hasNumbers = 0
  let hasExamples = 0
  
  article.sections.forEach((section: any, index: number) => {
    if (section.body) {
      const body = section.body
      totalWords += body.length
      
      // Short section check
      if (body.length < 200) {
        issues.shortSections.push(`Section ${index + 1}: ${body.length} chars`)
        structureScore -= 10
      }
      
      // Bad headings check
      if (body.includes('##') || body.includes('H2:') || body.includes('■')) {
        issues.badHeadings.push(`Section ${index + 1}: contains heading symbols`)
        structureScore -= 30
      }
      
      // Truncation check
      if (body.match(/…で。##|ROIシ##|外注はC##|AR##/)) {
        issues.truncations.push(`Section ${index + 1}: appears truncated`)
        structureScore -= 40
      }
      
      // Content richness
      if (body.match(/\d+[%億万円年月日]/)) hasNumbers++
      if (body.includes('例えば') || body.includes('具体的には')) hasExamples++
    }
  })
  
  // Calculate scores
  contentRichness = Math.min(100, (hasNumbers * 20) + (hasExamples * 15) + (totalWords > 2000 ? 30 : totalWords / 2000 * 30))
  readabilityScore = Math.min(100, article.sections.length >= 3 ? 50 : 0 + (totalWords > 1500 ? 30 : 0) + (hasExamples > 0 ? 20 : 0))
  
  return {
    structureScore: Math.max(0, structureScore),
    contentRichness: Math.round(contentRichness),
    readabilityScore: Math.round(readabilityScore),
    issues
  }
}

/**
 * サニタイズ済み入力データの前処理
 * AパスのstripHeadingsAndBulletsと同等の処理
 */
export function sanitizeArticleInputs(blocks: any[], context: string): {
  sanitizedBlocks: any[]
  sanitizedContext: string
} {
  const sanitizedBlocks = blocks.map(block => ({
    ...block,
    question: stripHeadingsFromText(block.question || ''),
    body: stripHeadingsFromText(block.body || '')
  }))
  
  const sanitizedContext = stripHeadingsFromText(context)
  
  return { sanitizedBlocks, sanitizedContext }
}

/**
 * テキストから見出し記号を除去（Bパス用）
 */
function stripHeadingsFromText(text: string): string {
  return text
    .replace(/^#+\s*/gm, '')      // Markdown見出し除去
    .replace(/^H[1-6]:?\s*/gm, '') // H1:, H2: 形式除去
    .replace(/^■.*?■/gm, '')      // ■見出し■除去
    .replace(/##\s*$/, '')        // 行末の ## 除去
    .replace(/…で。##.*$/, '…で。') // 途切れパターン修正
    .trim()
}