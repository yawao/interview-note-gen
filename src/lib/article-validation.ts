// Bパス記事検証機能
// Aパス（N-in/N-out、未回答固定）と同等の厳格なバリデーション
// 記事崩れ（見出し混入/途中切れ/重複）の自動検出・修正・ブロック

import { 
  StructuredArticle, 
  ArticleValidationResult, 
  ArticleQualityMetrics, 
  ArticleGenerationError,
  ArticleGenerationPayload 
} from '@/types/article'
import { stripHeadingsAndBullets } from '@/lib/text/sanitize'

/**
 * Bパス記事の包括的バリデーション
 * Aパスのvalidate系関数と同等の厳格さ
 */
export function validateArticleStructure(article: StructuredArticle): ArticleValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  let duplicateH2Count = 0
  let badHeadingsCount = 0
  
  // Required fields validation
  if (!article.title || typeof article.title !== 'string') {
    errors.push('title is required and must be a string')
  } else if (article.title.length < 10) {
    errors.push('title must be at least 10 characters')
  } else if (article.title.length > 60) {
    warnings.push('title is longer than recommended (60 chars)')
  }
  
  if (!article.lead || typeof article.lead !== 'string') {
    errors.push('lead is required and must be a string')
  } else if (article.lead.length < 50) {
    warnings.push('lead is shorter than recommended (50 chars)')
  } else if (article.lead.length > 300) {
    warnings.push('lead is longer than recommended (300 chars)')
  }
  
  if (!Array.isArray(article.sections)) {
    errors.push('sections must be an array')
  } else if (article.sections.length < 3) {
    errors.push('sections must have at least 3 items')
  } else if (article.sections.length > 5) {
    errors.push('sections must have at most 5 items')
  }
  
  // Section validation (like Aパス block validation)
  const h2Set = new Set<string>()
  let totalWordCount = (article.title?.length || 0) + (article.lead?.length || 0)
  
  if (Array.isArray(article.sections)) {
    for (let i = 0; i < article.sections.length; i++) {
      const section = article.sections[i]
      
      // H2 validation
      if (!section.h2 || typeof section.h2 !== 'string') {
        errors.push(`sections[${i}].h2 is required and must be a string`)
      } else {
        const normalizedH2 = section.h2.toLowerCase().trim()
        
        // Duplicate H2 check (similar to Aパス question duplication prevention)
        if (h2Set.has(normalizedH2)) {
          errors.push(`Duplicate H2 found: "${section.h2}"`)
          duplicateH2Count++
        } else {
          h2Set.add(normalizedH2)
        }
        
        // Heading contamination check
        if (containsHeadingSymbols(section.h2)) {
          errors.push(`sections[${i}].h2 contains forbidden heading symbols`)
          badHeadingsCount++
        }
      }
      
      // Body validation
      if (!section.body || typeof section.body !== 'string') {
        errors.push(`sections[${i}].body is required and must be a string`)
      } else {
        totalWordCount += section.body.length
        
        if (section.body.length < 200) {
          warnings.push(`sections[${i}].body is shorter than recommended (200 chars)`)
        }
        
        if (section.body.length > 800) {
          warnings.push(`sections[${i}].body is longer than recommended (800 chars)`)
        }
        
        // Critical: Heading contamination in body (防止すべき主要な崩れ)
        if (containsHeadingSymbols(section.body)) {
          errors.push(`sections[${i}].body contains forbidden heading symbols`)
          badHeadingsCount++
        }
        
        // Critical: Truncation detection (途切れ検出)
        if (detectTruncation(section.body)) {
          errors.push(`sections[${i}].body appears to be truncated`)
        }
      }
    }
  }
  
  // FAQ validation (if present)
  if (article.faq && Array.isArray(article.faq)) {
    for (let i = 0; i < article.faq.length; i++) {
      const faq = article.faq[i]
      if (!faq.q || typeof faq.q !== 'string') {
        errors.push(`faq[${i}].q is required and must be a string`)
      }
      if (!faq.a || typeof faq.a !== 'string') {
        errors.push(`faq[${i}].a is required and must be a string`)
      } else {
        totalWordCount += faq.q.length + faq.a.length
      }
    }
  }
  
  // CTA validation (if present)
  if (article.cta) {
    if (typeof article.cta !== 'string') {
      errors.push('cta must be a string')
    } else {
      totalWordCount += article.cta.length
    }
  }
  
  const stats = {
    titleLength: article.title?.length || 0,
    leadLength: article.lead?.length || 0,
    sectionCount: Array.isArray(article.sections) ? article.sections.length : 0,
    totalWordCount,
    duplicateH2Count,
    badHeadingsCount
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats
  }
}

/**
 * 章構成ホワイトリスト（Claude Code整形指示対応）
 */
export const SECTION_WHITELIST = [
  '導入',
  '背景と課題',
  '着想とインプット収集',
  '仮説整理と事業性評価', 
  'MVP／PoCでの小規模検証',
  'まとめ',
  'FAQ',
  'CTA'
] as const

export const REQUIRED_SECTIONS = [
  '導入',
  '背景と課題',
  'MVP／PoCでの小規模検証',
  'まとめ'
] as const

/**
 * 記事品質の詳細分析（崩れパターンの検出＋章構成チェック）
 */
export function analyzeArticleQuality(article: StructuredArticle): ArticleQualityMetrics {
  let structureScore = 100
  let contentRichness = 0
  let readabilityScore = 0
  
  const duplicateIssues: string[] = []
  const truncationIssues: string[] = []
  const headingIssues: string[] = []
  
  if (!article.sections || !Array.isArray(article.sections)) {
    return {
      structureScore: 0,
      contentRichness: 0,
      readabilityScore: 0,
      duplicateIssues,
      truncationIssues,
      headingIssues
    }
  }
  
  // Duplicate H2 analysis
  const h2Map = new Map<string, number>()
  article.sections.forEach((section, index) => {
    if (section.h2) {
      const normalized = section.h2.toLowerCase().trim()
      const count = h2Map.get(normalized) || 0
      h2Map.set(normalized, count + 1)
      
      if (count > 0) {
        duplicateIssues.push(`"${section.h2}" (section ${index + 1})`)
        structureScore -= 25 // 重複ごとに大幅減点
      }
    }
  })
  
  // Content analysis
  let totalWords = (article.title?.length || 0) + (article.lead?.length || 0)
  let hasNumbers = 0
  let hasExamples = 0
  let hasActionableContent = 0
  
  article.sections.forEach((section, index) => {
    if (section.body) {
      const body = section.body
      totalWords += body.length
      
      // Heading contamination check
      if (containsHeadingSymbols(section.h2) || containsHeadingSymbols(body)) {
        headingIssues.push(`Section ${index + 1}: contains heading symbols`)
        structureScore -= 30 // 見出し混入は重大なエラー
      }
      
      // Truncation check
      if (detectTruncation(body)) {
        truncationIssues.push(`Section ${index + 1}: appears truncated`)
        structureScore -= 40 // 途切れも重大なエラー
      }
      
      // Content richness indicators
      if (body.match(/\d+[%億万円年月日時間分]/)) hasNumbers++
      if (body.includes('例えば') || body.includes('具体的には') || body.includes('たとえば')) hasExamples++
      if (body.includes('する') || body.includes('できます') || body.includes('方法') || body.includes('手順')) hasActionableContent++
    }
  })
  
  // Calculate content richness (0-100)
  contentRichness = Math.min(100, 
    (hasNumbers * 20) + 
    (hasExamples * 15) + 
    (hasActionableContent * 10) + 
    (totalWords > 2000 ? 30 : Math.floor(totalWords / 2000 * 30))
  )
  
  // Calculate readability (0-100)
  readabilityScore = Math.min(100,
    (article.sections.length >= 3 ? 40 : article.sections.length * 13) +
    (totalWords > 1500 ? 30 : Math.floor(totalWords / 1500 * 30)) +
    (hasExamples > 0 ? 20 : 0) +
    (duplicateIssues.length === 0 ? 10 : 0)
  )
  
  return {
    structureScore: Math.max(0, structureScore),
    contentRichness: Math.round(contentRichness),
    readabilityScore: Math.round(readabilityScore),
    duplicateIssues,
    truncationIssues,
    headingIssues
  }
}

/**
 * Aパス同様のclampAndNormalize処理（Bパス版）
 * 構造の強制正規化と安全化
 */
export function clampAndNormalizeArticle(
  payload: ArticleGenerationPayload,
  generated: StructuredArticle
): StructuredArticle {
  console.log('🔧 Bパス記事バリデーション開始')
  console.log(`- 生成セクション数: ${generated.sections?.length || 0}`)
  console.log(`- 入力ブロック数: ${payload.blocks?.length || 0}`)
  
  // Section数を3-5に強制クランプ
  let sections = generated.sections || []
  if (sections.length < 3) {
    console.warn(`⚠️ セクション不足: ${sections.length} < 3, 最小構造で補完`)
    // 不足分を「未回答」で補完（Aパス思想と同様）
    while (sections.length < 3) {
      sections.push({
        h2: `追加トピック${sections.length + 1}`,
        body: 'この点については詳細な情報が不足していました。'
      })
    }
  } else if (sections.length > 5) {
    console.warn(`⚠️ セクション過多: ${sections.length} > 5, 最初5つに切り詰め`)
    sections = sections.slice(0, 5)
  }
  
  // 各セクションの正規化
  const normalizedSections = sections.map((section, index) => {
    let h2 = section.h2 || `セクション${index + 1}`
    let body = section.body || '未回答'
    
    // 見出し記号の除去（サニタイズ）
    h2 = sanitizeHeading(h2)
    body = sanitizeBody(body)
    
    // 途切れ修復
    body = repairTruncation(body)
    
    return { h2, body }
  })
  
  // 重複H2の解決
  const uniqueSections = deduplicateH2(normalizedSections)
  
  return {
    title: sanitizeHeading(generated.title || 'インタビュー記事'),
    lead: sanitizeBody(generated.lead || '本記事では、インタビュー内容をもとに重要なポイントをまとめました。'),
    sections: uniqueSections,
    faq: generated.faq?.map(faq => ({
      q: sanitizeBody(faq.q),
      a: sanitizeBody(faq.a)
    })),
    cta: generated.cta ? sanitizeBody(generated.cta) : undefined
  }
}

/**
 * 見出し記号の検出
 */
function containsHeadingSymbols(text: string): boolean {
  if (!text) return false
  
  const patterns = [
    /^#+\s/, // Markdown見出し
    /H[1-6]:/i, // H1:, H2: 形式
    /^■.*■$/, // ■見出し■
    /##/, // 見出し記号
    /#\s*$/ // 行末の#
  ]
  
  return patterns.some(pattern => pattern.test(text))
}

/**
 * 途切れパターンの検出
 */
function detectTruncation(text: string): boolean {
  if (!text) return false
  
  const truncationPatterns = [
    /…で。##/,      // 典型的な途切れ
    /ROIシ##/,      // 単語途中での切断
    /外注はC##/,    // 同上
    /AR##/,         // 同上
    /[あ-ん]##$/,   // ひらがな＋##で終わる
    /、##$/,        // 読点＋##で終わる
    /。##$/,        // 句点＋##で終わる（異常）
    /##\s*$/,       // 行末の##
  ]
  
  return truncationPatterns.some(pattern => pattern.test(text))
}

/**
 * 見出しテキストのサニタイズ
 */
function sanitizeHeading(text: string): string {
  return stripHeadingsAndBullets(text)
    .replace(/^#+\s*/, '')
    .replace(/\s*#+\s*$/, '')
    .replace(/H[1-6]:\s*/i, '')
    .replace(/^■(.*?)■$/, '$1')
    .trim()
}

/**
 * 本文のサニタイズ
 */
function sanitizeBody(text: string): string {
  let sanitized = stripHeadingsAndBullets(text)
  
  // 見出し記号の除去
  sanitized = sanitized
    .replace(/##[^#\n]*$/gm, '') // 行末の##以降を除去
    .replace(/H[1-6]:\s*/gi, '') // H1:, H2:形式の除去
    .replace(/^■.*■$/gm, '') // ■見出し■行の除去
    .trim()
  
  return sanitized
}

/**
 * 途切れの修復
 */
function repairTruncation(text: string): string {
  return text
    .replace(/…で。##.*$/, '…で。')
    .replace(/ROIシ##.*$/, 'ROIについては詳細な分析が必要です。')
    .replace(/外注はC##.*$/, '外注については慎重な検討が必要です。')
    .replace(/AR##.*$/, 'この点については追加の調査が必要です。')
    .replace(/[あ-ん]##.*$/, '') // ひらがな＋##で終わる場合は削除
    .replace(/、##.*$/, '。') // 読点＋##は句点で終了
    .replace(/。##.*$/, '。') // 句点＋##は句点のまま
    .replace(/##\s*$/, '') // 行末の##を除去
}

/**
 * 重複H2の解決
 */
function deduplicateH2(sections: { h2: string; body: string }[]): { h2: string; body: string }[] {
  const seen = new Set<string>()
  const deduplicated: { h2: string; body: string }[] = []
  
  for (const section of sections) {
    let h2 = section.h2
    const normalizedH2 = h2.toLowerCase().trim()
    
    if (seen.has(normalizedH2)) {
      // 重複の場合は数字を付与
      let counter = 2
      let newH2 = `${h2}（${counter}）`
      while (seen.has(newH2.toLowerCase().trim())) {
        counter++
        newH2 = `${h2}（${counter}）`
      }
      h2 = newH2
    }
    
    seen.add(h2.toLowerCase().trim())
    deduplicated.push({ h2, body: section.body })
  }
  
  return deduplicated
}

/**
 * 章構成ホワイトリスト検証
 */
export function validateSectionWhitelist(article: StructuredArticle): {
  isValid: boolean
  invalidSections: string[]
  missingSections: string[]
  sectionOrderValid: boolean
} {
  const invalidSections: string[] = []
  const missingSections: string[] = []
  const presentSections = article.sections?.map(s => s.h2) || []
  
  // ホワイトリスト外の章をチェック
  for (const section of presentSections) {
    if (!SECTION_WHITELIST.includes(section as any)) {
      invalidSections.push(section)
    }
  }
  
  // 必須章の不足をチェック  
  for (const required of REQUIRED_SECTIONS) {
    if (!presentSections.includes(required)) {
      missingSections.push(required)
    }
  }
  
  // 章順序のチェック（簡易版：必須章が正しい相対順序か）
  const requiredIndices = REQUIRED_SECTIONS.map(req => 
    presentSections.findIndex(s => s === req)
  ).filter(idx => idx >= 0)
  
  const sectionOrderValid = requiredIndices.length <= 1 || 
    requiredIndices.every((idx, i, arr) => i === 0 || idx > arr[i - 1])
  
  return {
    isValid: invalidSections.length === 0 && missingSections.length === 0 && sectionOrderValid,
    invalidSections,
    missingSections, 
    sectionOrderValid
  }
}

/**
 * Claude Code整形指示準拠の自己検査機能
 */
export function performSelfValidation(article: StructuredArticle): {
  duplicate_h2: boolean
  inline_h2_leak: boolean  
  broken_sentence: boolean
  missing_required: string[]
  faq_cta_dup: boolean
  dangling_h2: string[]
  repairs_applied: string[]
} {
  const repairs_applied: string[] = []
  
  // duplicate_h2: 同名H2が複数ないか
  const h2Map = new Map<string, number>()
  const presentH2s = article.sections?.map(s => s.h2) || []
  presentH2s.forEach(h2 => {
    h2Map.set(h2, (h2Map.get(h2) || 0) + 1)
  })
  const duplicate_h2 = Array.from(h2Map.values()).some(count => count > 1)
  
  // inline_h2_leak: 行中に「[^\\n]##\\s」が存在しないか
  let inline_h2_leak = false
  article.sections?.forEach(section => {
    if (section.body && /[^\n]##\s/.test(section.body)) {
      inline_h2_leak = true
    }
  })
  if (article.lead && /[^\n]##\s/.test(article.lead)) {
    inline_h2_leak = true
  }
  
  // broken_sentence: 各見出し直前の文末が句点で終わっているか（bodyの末尾チェック）
  let broken_sentence = false
  article.sections?.forEach(section => {
    if (section.body && !/[。.]$/.test(section.body.trim())) {
      broken_sentence = true
    }
  })
  
  // missing_required: 必須章が欠けていないか
  const whitelistCheck = validateSectionWhitelist(article)
  const missing_required = whitelistCheck.missingSections
  
  // faq_cta_dup: FAQ/CTAが二重になっていないか
  const faqCount = presentH2s.filter(h2 => h2 === 'FAQ').length
  const ctaCount = presentH2s.filter(h2 => h2 === 'CTA').length
  const faq_cta_dup = faqCount > 1 || ctaCount > 1
  
  // dangling_h2: 本文が1文以下のH2が無いか  
  const dangling_h2: string[] = []
  article.sections?.forEach(section => {
    const sentenceCount = (section.body?.match(/[。.]/g) || []).length
    if (sentenceCount < 2) {
      dangling_h2.push(section.h2)
    }
  })
  
  return {
    duplicate_h2,
    inline_h2_leak,
    broken_sentence,
    missing_required,
    faq_cta_dup,
    dangling_h2,
    repairs_applied
  }
}

/**
 * 記事生成結果の最終検証（受け入れ基準チェック＋Claude Code整形指示準拠）
 */
export function validateFinalArticle(article: StructuredArticle): {
  passed: boolean
  results: {
    structureCompliant: boolean
    sectionCountValid: boolean
    duplicateH2Count: number
    badHeadingsCount: number
    truncationCount: number
    whitelistCompliant: boolean
    selfValidationPassed: boolean
  }
  issues: string[]
  selfValidation: ReturnType<typeof performSelfValidation>
} {
  const validation = validateArticleStructure(article)
  const quality = analyzeArticleQuality(article)
  const whitelistCheck = validateSectionWhitelist(article)
  const selfValidation = performSelfValidation(article)
  const issues: string[] = []
  
  // 受け入れ基準のチェック
  const structureCompliant = validation.isValid
  const sectionCountValid = validation.stats.sectionCount >= 3 && validation.stats.sectionCount <= 6 // Claude Code対応で最大6に拡張
  const duplicateH2Count = quality.duplicateIssues.length
  const badHeadingsCount = quality.headingIssues.length
  const truncationCount = quality.truncationIssues.length
  const whitelistCompliant = whitelistCheck.isValid
  const selfValidationPassed = !selfValidation.duplicate_h2 && 
                               !selfValidation.inline_h2_leak && 
                               !selfValidation.broken_sentence && 
                               selfValidation.missing_required.length === 0 && 
                               !selfValidation.faq_cta_dup && 
                               selfValidation.dangling_h2.length === 0
  
  if (!structureCompliant) {
    issues.push(...validation.errors)
  }
  
  if (!sectionCountValid) {
    issues.push(`Section count ${validation.stats.sectionCount} is outside valid range (3-6)`)
  }
  
  if (duplicateH2Count > 0) {
    issues.push(`Found ${duplicateH2Count} duplicate H2 headings`)
  }
  
  if (badHeadingsCount > 0) {
    issues.push(`Found ${badHeadingsCount} heading contamination issues`)
  }
  
  if (truncationCount > 0) {
    issues.push(`Found ${truncationCount} truncation issues`)
  }
  
  if (!whitelistCompliant) {
    if (whitelistCheck.invalidSections.length > 0) {
      issues.push(`Invalid sections not in whitelist: ${whitelistCheck.invalidSections.join(', ')}`)
    }
    if (whitelistCheck.missingSections.length > 0) {
      issues.push(`Missing required sections: ${whitelistCheck.missingSections.join(', ')}`)
    }
    if (!whitelistCheck.sectionOrderValid) {
      issues.push('Section order is invalid')
    }
  }
  
  if (!selfValidationPassed) {
    issues.push('Claude Code self-validation failed')
    if (selfValidation.duplicate_h2) issues.push('Self-check: duplicate H2 found')
    if (selfValidation.inline_h2_leak) issues.push('Self-check: inline ## leak detected')
    if (selfValidation.broken_sentence) issues.push('Self-check: broken sentence endings')
    if (selfValidation.missing_required.length > 0) issues.push(`Self-check: missing required sections: ${selfValidation.missing_required.join(', ')}`)
    if (selfValidation.faq_cta_dup) issues.push('Self-check: FAQ/CTA duplication')
    if (selfValidation.dangling_h2.length > 0) issues.push(`Self-check: dangling H2s: ${selfValidation.dangling_h2.join(', ')}`)
  }
  
  const passed = structureCompliant && 
                 sectionCountValid && 
                 duplicateH2Count === 0 && 
                 badHeadingsCount === 0 && 
                 truncationCount === 0 &&
                 whitelistCompliant &&
                 selfValidationPassed
  
  return {
    passed,
    results: {
      structureCompliant,
      sectionCountValid,
      duplicateH2Count,
      badHeadingsCount,
      truncationCount,
      whitelistCompliant,
      selfValidationPassed
    },
    issues,
    selfValidation
  }
}