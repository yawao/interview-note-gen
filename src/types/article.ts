// Bパス（読み物記事）用の構造化スキーマ定義
// Aパスと同等の構造ガードを実現するため、JSON I/O で厳格な型を定義

/**
 * H2セクション定義
 */
export interface ArticleSection {
  h2: string    // H2見出しテキスト（重複禁止）
  body: string  // 本文（400-600文字推奨、見出し記号含まず）
}

/**
 * FAQ項目定義
 */
export interface ArticleFAQ {
  q: string     // 質問
  a: string     // 回答
}

/**
 * Bパス構造化記事スキーマ
 * LLMはこの構造のJSONのみを出力し、Markdownは含めない
 */
export interface StructuredArticle {
  title: string                // H1タイトル（30-40文字推奨）
  lead: string                 // リード文（3-4文、記事の概要）
  sections: ArticleSection[]   // メインセクション（3-5個必須）
  faq?: ArticleFAQ[]          // FAQ（オプション）
  cta?: string                // Call To Action（最後の行動喚起）
}

/**
 * JSON Schema for OpenAI response_format
 * Bパス記事生成時の構造検証用
 */
export const structuredArticleSchema = {
  type: "object",
  properties: {
    title: { 
      type: "string",
      minLength: 10,
      maxLength: 60
    },
    lead: { 
      type: "string",
      minLength: 50,
      maxLength: 300
    },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          h2: { 
            type: "string",
            minLength: 5,
            maxLength: 50
          },
          body: { 
            type: "string",
            minLength: 200,
            maxLength: 800
          }
        },
        required: ["h2", "body"],
        additionalProperties: false
      }
    },
    faq: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          q: { type: "string", minLength: 10, maxLength: 100 },
          a: { type: "string", minLength: 20, maxLength: 300 }
        },
        required: ["q", "a"],
        additionalProperties: false
      }
    },
    cta: {
      type: "string",
      minLength: 20,
      maxLength: 200
    }
  },
  required: ["title", "lead", "sections"],
  additionalProperties: false
} as const

/**
 * Bパス記事構造バリデーション結果
 */
export interface ArticleValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    titleLength: number
    leadLength: number
    sectionCount: number
    totalWordCount: number
    duplicateH2Count: number
    badHeadingsCount: number
  }
}

/**
 * 記事品質分析結果
 */
export interface ArticleQualityMetrics {
  structureScore: number      // 0-100: 構造の完全性
  contentRichness: number     // 0-100: 内容の充実度
  readabilityScore: number    // 0-100: 読みやすさ
  duplicateIssues: string[]   // 重複問題の詳細
  truncationIssues: string[]  // 途切れ問題の詳細
  headingIssues: string[]     // 見出し混入問題の詳細
}

/**
 * Bパス記事生成のペイロード
 * Aパスと同様の思想で素材を構造化
 */
export interface ArticleGenerationPayload {
  theme: string               // 記事テーマ
  blocks: {                   // 元のQ&Aブロック（Aパスからの流用）
    question: string
    body: string
    hasEvidence: boolean
  }[]
  context: string             // サニタイズ済み追加コンテキスト
  options?: {
    maxSections?: number      // セクション数上限（3-5）
    tone?: string            // 文体指定
    targetLength?: number    // 目標文字数
  }
}

/**
 * 記事生成エラー種別
 */
export enum ArticleGenerationError {
  STRUCTURE_INVALID = 'STRUCTURE_INVALID',
  DUPLICATE_HEADINGS = 'DUPLICATE_HEADINGS', 
  CONTENT_TRUNCATED = 'CONTENT_TRUNCATED',
  HEADING_CONTAMINATION = 'HEADING_CONTAMINATION',
  INSUFFICIENT_SECTIONS = 'INSUFFICIENT_SECTIONS',
  SECTION_TOO_SHORT = 'SECTION_TOO_SHORT',
  JSON_PARSE_FAILED = 'JSON_PARSE_FAILED'
}

/**
 * 記事生成結果
 */
export interface ArticleGenerationResult {
  success: boolean
  article?: StructuredArticle
  markdown?: string           // レンダリング済みMarkdown
  validation: ArticleValidationResult
  quality: ArticleQualityMetrics
  error?: {
    type: ArticleGenerationError
    message: string
    details?: any
  }
  metadata: {
    inputLength: number
    outputLength: number
    processingTime: number
    modelUsed: string
    retryCount: number
  }
}