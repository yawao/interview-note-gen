import { StructuredInterviewSummary, InterviewItem, InterviewExtractionOptions } from '@/types'

/**
 * インタビュー項目のスキーマ検証と正規化
 */

export class InterviewValidationError extends Error {
  constructor(message: string, public violations: string[]) {
    super(message)
    this.name = 'InterviewValidationError'
  }
}

/**
 * 基本的なスキーマ検証
 */
export function validateInterviewSummary(
  data: any,
  expectedQuestionCount: number
): { isValid: boolean; violations: string[] } {
  const violations: string[] = []

  // 基本構造チェック
  if (!data || typeof data !== 'object') {
    violations.push('データがオブジェクトではありません')
    return { isValid: false, violations }
  }

  if (!Array.isArray(data.items)) {
    violations.push('items が配列ではありません')
    return { isValid: false, violations }
  }

  // 件数チェック
  if (data.items.length !== expectedQuestionCount) {
    violations.push(`項目数が期待値と異なります: 期待=${expectedQuestionCount}, 実際=${data.items.length}`)
  }

  // 各項目のチェック
  data.items.forEach((item: any, index: number) => {
    const prefix = `項目[${index}]:`

    if (typeof item.question !== 'string') {
      violations.push(`${prefix} question が文字列ではありません`)
    }

    if (item.answer !== null && typeof item.answer !== 'string') {
      violations.push(`${prefix} answer が null または文字列ではありません`)
    }

    if (!['answered', 'unanswered'].includes(item.status)) {
      violations.push(`${prefix} status が 'answered' または 'unanswered' ではありません`)
    }

    if (!Array.isArray(item.evidence)) {
      violations.push(`${prefix} evidence が配列ではありません`)
    }

    // answered の場合の制約チェック
    if (item.status === 'answered') {
      if (item.answer === null || item.answer === '') {
        violations.push(`${prefix} status=answered なのに answer が空です`)
      }
      
      if (!item.evidence || item.evidence.length === 0) {
        violations.push(`${prefix} status=answered なのに evidence が空です`)
      }
    }

    // unanswered の場合の制約チェック
    if (item.status === 'unanswered') {
      if (item.answer !== null) {
        violations.push(`${prefix} status=unanswered なのに answer が null ではありません`)
      }
    }
  })

  return { isValid: violations.length === 0, violations }
}

/**
 * 根拠の真正性チェック
 */
export function validateEvidence(evidence: string[], transcript: string): boolean {
  if (!evidence || evidence.length === 0) return false
  
  return evidence.every(quote => {
    // 引用がトランスクリプトに実在するかチェック
    const normalizedQuote = quote.trim().toLowerCase()
    const normalizedTranscript = transcript.toLowerCase()
    return normalizedTranscript.includes(normalizedQuote)
  })
}

/**
 * データの防御的正規化
 */
export function normalizeInterviewSummary(
  data: any,
  questions: string[],
  transcript: string,
  options: InterviewExtractionOptions = {
    strict_no_autofill: true,
    exact_length_output: true,
    unanswered_token: '未回答'
  }
): StructuredInterviewSummary {
  const items: InterviewItem[] = []

  // 期待される質問数まで処理
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    let item: InterviewItem

    if (data?.items && data.items[i]) {
      const rawItem = data.items[i]
      
      // 基本的なデータ整形
      item = {
        question: question, // 元の質問を使用
        answer: rawItem.answer || null,
        status: rawItem.status || 'unanswered',
        evidence: Array.isArray(rawItem.evidence) ? rawItem.evidence : []
      }

      // answered状態の検証と修正
      if (item.status === 'answered') {
        // 回答が空または根拠が無効な場合はunansweredにダウンシフト
        if (!item.answer || 
            item.evidence.length === 0 || 
            !validateEvidence(item.evidence, transcript)) {
          item = {
            question: question,
            answer: null,
            status: 'unanswered',
            evidence: []
          }
        }
      }

      // unanswered状態の強制
      if (item.status === 'unanswered') {
        item.answer = null
        item.evidence = []
      }
    } else {
      // データがない場合は未回答でパディング
      item = {
        question: question,
        answer: null,
        status: 'unanswered',
        evidence: []
      }
    }

    items.push(item)
  }

  return { items }
}

/**
 * LLM出力の修復プロンプト生成
 */
export function generateRepairPrompt(
  originalData: any,
  violations: string[],
  expectedQuestionCount: number
): string {
  return `前回出力はスキーマ違反です。以下の違反点を修正して、JSON形式で再出力してください：

違反点：
${violations.map(v => `- ${v}`).join('\n')}

修正要件：
- items の件数をちょうど ${expectedQuestionCount} にしてください
- status が "answered" の場合は evidence を最低1件含めてください
- status が "unanswered" の場合は answer を null にしてください
- JSON形式のみで出力し、余計な文章は含めないでください

修正後のJSONを出力してください：`
}

/**
 * デバッグ情報の生成
 */
export function generateDebugInfo(
  data: any,
  questions: string[],
  transcript: string
): string {
  const validation = validateInterviewSummary(data, questions.length)
  
  return `
=== インタビュー抽出デバッグ情報 ===
質問数: ${questions.length}
項目数: ${data?.items?.length || 0}
バリデーション: ${validation.isValid ? '✅ 合格' : '❌ 失敗'}

${validation.violations.length > 0 ? `
違反点:
${validation.violations.map(v => `- ${v}`).join('\n')}
` : ''}

トランスクリプト長: ${transcript.length}文字
生データ: ${JSON.stringify(data, null, 2)}
`
}