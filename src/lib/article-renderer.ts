// Bパス専用 JSON→Markdownレンダラー
// 構造化されたJSONからMarkdownを安全に生成（LLMにMarkdown記号を書かせない）

import { StructuredArticle, ArticleSection, ArticleFAQ } from '@/types/article'

/**
 * 構造化記事をMarkdownにレンダリング
 * LLMが出力したJSONから、安全なMarkdownを生成
 */
export function renderMarkdown(article: StructuredArticle): string {
  const sections: string[] = []
  
  // H1 タイトル
  sections.push(`# ${sanitizeText(article.title)}`)
  sections.push('')
  
  // リード文
  sections.push(sanitizeText(article.lead))
  sections.push('')
  
  // メインセクション
  for (const section of article.sections) {
    sections.push(`## ${sanitizeText(section.h2)}`)
    sections.push('')
    sections.push(sanitizeText(section.body))
    sections.push('')
  }
  
  // FAQ（オプション）
  if (article.faq && article.faq.length > 0) {
    sections.push('## FAQ')
    sections.push('')
    
    for (const faq of article.faq) {
      sections.push(`**Q: ${sanitizeText(faq.q)}**`)
      sections.push('')
      sections.push(`A: ${sanitizeText(faq.a)}`)
      sections.push('')
    }
  }
  
  // CTA（オプション）
  if (article.cta) {
    sections.push('## まとめ')
    sections.push('')
    sections.push(sanitizeText(article.cta))
    sections.push('')
  }
  
  return sections.join('\n').trim()
}

/**
 * HTML形式でレンダリング（Web表示用）
 */
export function renderHTML(article: StructuredArticle): string {
  const sections: string[] = []
  
  sections.push('<article>')
  
  // H1 タイトル
  sections.push(`<h1>${escapeHTML(sanitizeText(article.title))}</h1>`)
  
  // リード文
  sections.push(`<p class="lead">${escapeHTML(sanitizeText(article.lead))}</p>`)
  
  // メインセクション
  for (const section of article.sections) {
    sections.push(`<h2>${escapeHTML(sanitizeText(section.h2))}</h2>`)
    sections.push(`<div class="section-body">${formatHTMLBody(section.body)}</div>`)
  }
  
  // FAQ（オプション）
  if (article.faq && article.faq.length > 0) {
    sections.push('<h2>FAQ</h2>')
    sections.push('<div class="faq-section">')
    
    for (const faq of article.faq) {
      sections.push('<div class="faq-item">')
      sections.push(`<div class="faq-question"><strong>Q: ${escapeHTML(sanitizeText(faq.q))}</strong></div>`)
      sections.push(`<div class="faq-answer">A: ${escapeHTML(sanitizeText(faq.a))}</div>`)
      sections.push('</div>')
    }
    
    sections.push('</div>')
  }
  
  // CTA（オプション）
  if (article.cta) {
    sections.push('<h2>まとめ</h2>')
    sections.push(`<div class="cta-section">${escapeHTML(sanitizeText(article.cta))}</div>`)
  }
  
  sections.push('</article>')
  
  return sections.join('\n')
}

/**
 * プレーンテキスト形式でレンダリング（メール・SMS用）
 */
export function renderPlainText(article: StructuredArticle): string {
  const sections: string[] = []
  
  // タイトル
  sections.push(sanitizeText(article.title))
  sections.push('='.repeat(article.title.length))
  sections.push('')
  
  // リード文
  sections.push(sanitizeText(article.lead))
  sections.push('')
  
  // メインセクション
  for (let i = 0; i < article.sections.length; i++) {
    const section = article.sections[i]
    sections.push(`${i + 1}. ${sanitizeText(section.h2)}`)
    sections.push('-'.repeat(section.h2.length + 3))
    sections.push('')
    sections.push(sanitizeText(section.body))
    sections.push('')
  }
  
  // FAQ（オプション）
  if (article.faq && article.faq.length > 0) {
    sections.push('FAQ')
    sections.push('---')
    sections.push('')
    
    for (let i = 0; i < article.faq.length; i++) {
      const faq = article.faq[i]
      sections.push(`Q${i + 1}: ${sanitizeText(faq.q)}`)
      sections.push(`A${i + 1}: ${sanitizeText(faq.a)}`)
      sections.push('')
    }
  }
  
  // CTA（オプション）
  if (article.cta) {
    sections.push('まとめ')
    sections.push('----')
    sections.push('')
    sections.push(sanitizeText(article.cta))
    sections.push('')
  }
  
  return sections.join('\n').trim()
}

/**
 * 記事の統計情報を生成
 */
export function generateArticleStats(article: StructuredArticle): {
  titleLength: number
  leadLength: number
  sectionCount: number
  totalWordCount: number
  avgSectionLength: number
  faqCount: number
  estimatedReadingTime: number
  uniqueH2Count: number
  duplicateH2Issues: string[]
} {
  const titleLength = article.title.length
  const leadLength = article.lead.length
  const sectionCount = article.sections.length
  
  let totalWordCount = titleLength + leadLength
  let totalSectionLength = 0
  
  // H2重複チェック
  const h2Set = new Set<string>()
  const duplicateH2Issues: string[] = []
  
  for (const section of article.sections) {
    const sectionLength = section.h2.length + section.body.length
    totalSectionLength += sectionLength
    totalWordCount += sectionLength
    
    const normalizedH2 = section.h2.toLowerCase().trim()
    if (h2Set.has(normalizedH2)) {
      duplicateH2Issues.push(section.h2)
    } else {
      h2Set.add(normalizedH2)
    }
  }
  
  const faqCount = article.faq ? article.faq.length : 0
  if (article.faq) {
    for (const faq of article.faq) {
      totalWordCount += faq.q.length + faq.a.length
    }
  }
  
  if (article.cta) {
    totalWordCount += article.cta.length
  }
  
  const avgSectionLength = sectionCount > 0 ? Math.round(totalSectionLength / sectionCount) : 0
  const estimatedReadingTime = Math.ceil(totalWordCount / 400) // 400文字/分として計算
  
  return {
    titleLength,
    leadLength,
    sectionCount,
    totalWordCount,
    avgSectionLength,
    faqCount,
    estimatedReadingTime,
    uniqueH2Count: h2Set.size,
    duplicateH2Issues
  }
}

/**
 * 記事構造の健全性チェック
 */
export function validateRenderedArticle(markdown: string): {
  isHealthy: boolean
  issues: string[]
  stats: {
    h1Count: number
    h2Count: number
    h3Count: number
    suspiciousPatterns: string[]
    truncationSignals: string[]
  }
} {
  const issues: string[] = []
  const suspiciousPatterns: string[] = []
  const truncationSignals: string[] = []
  
  // 見出し数をカウント
  const h1Count = (markdown.match(/^# /gm) || []).length
  const h2Count = (markdown.match(/^## /gm) || []).length
  const h3Count = (markdown.match(/^### /gm) || []).length
  
  // 基本構造チェック
  if (h1Count !== 1) {
    issues.push(`H1見出しが${h1Count}個（1個であるべき）`)
  }
  if (h2Count < 3) {
    issues.push(`H2見出しが${h2Count}個（3個以上であるべき）`)
  }
  if (h2Count > 5) {
    issues.push(`H2見出しが${h2Count}個（5個以下であるべき）`)
  }
  
  // 異常パターンの検出
  const badPatterns = [
    { pattern: /…で。##/, message: '文途切れ with ##' },
    { pattern: /ROIシ##/, message: 'ROI途切れ' },
    { pattern: /外注はC##/, message: '外注途切れ' },
    { pattern: /AR##/, message: 'AR途切れ' },
    { pattern: /^##[^#\s]/, message: '見出し直後に文字' },
    { pattern: /H[1-6]:/, message: 'H1:形式の混入' },
    { pattern: /^■.*■$/, message: '■見出し■形式の混入' }
  ]
  
  for (const { pattern, message } of badPatterns) {
    const matches = markdown.match(pattern)
    if (matches) {
      suspiciousPatterns.push(message)
      issues.push(`異常パターン検出: ${message}`)
    }
  }
  
  // 途切れシグナルの検出
  const truncationPatterns = [
    /\.\.\.$/, // 行末の...
    /…$/, // 行末の…
    /で。$/, // で。で終わる不自然な文
    /、$/ // 読点で終わる文
  ]
  
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.length > 0 && !line.startsWith('#')) {
      for (const pattern of truncationPatterns) {
        if (pattern.test(line)) {
          truncationSignals.push(`Line ${i + 1}: ${line.substring(0, 50)}...`)
        }
      }
    }
  }
  
  const isHealthy = issues.length === 0
  
  return {
    isHealthy,
    issues,
    stats: {
      h1Count,
      h2Count,
      h3Count,
      suspiciousPatterns,
      truncationSignals
    }
  }
}

/**
 * テキストのサニタイズ（二重安全装置）
 * LLMが誤って出力した場合の保険
 */
function sanitizeText(text: string): string {
  return text
    .replace(/^#+\s*/, '') // 先頭の##を除去
    .replace(/\s*#+\s*$/, '') // 末尾の##を除去
    .replace(/H[1-6]:\s*/, '') // H1:, H2:形式を除去
    .replace(/^■(.*?)■$/, '$1') // ■見出し■を見出しテキストのみに
    .replace(/…で。##.*$/, '…で。') // 途切れパターンの修正
    .trim()
}

/**
 * HTML用のテキストエスケープ
 */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * HTML本文の整形（段落分けなど）
 */
function formatHTMLBody(body: string): string {
  const sanitized = sanitizeText(body)
  const paragraphs = sanitized.split('\n\n')
  
  return paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${escapeHTML(p)}</p>`)
    .join('\n')
}

/**
 * レンダリング用のオプション
 */
export interface RenderOptions {
  format: 'markdown' | 'html' | 'plaintext'
  includeStats?: boolean
  validateHealth?: boolean
  customCSS?: string
}

/**
 * 統合レンダリング関数
 */
export function renderArticle(
  article: StructuredArticle, 
  options: RenderOptions = { format: 'markdown' }
): {
  content: string
  stats?: ReturnType<typeof generateArticleStats>
  health?: ReturnType<typeof validateRenderedArticle>
} {
  let content: string
  
  switch (options.format) {
    case 'html':
      content = renderHTML(article)
      break
    case 'plaintext':
      content = renderPlainText(article)
      break
    case 'markdown':
    default:
      content = renderMarkdown(article)
      break
  }
  
  const result: any = { content }
  
  if (options.includeStats) {
    result.stats = generateArticleStats(article)
  }
  
  if (options.validateHealth) {
    result.health = validateRenderedArticle(content)
  }
  
  return result
}