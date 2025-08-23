// Legacy compatibility for existing openai.ts
// 既存のopenai.tsとの後方互換性維持

import { StructuredInterviewSummary, InterviewItem, InterviewExtractionOptions } from '@/types'

export function validateInterviewSummary(
  data: any,
  expectedCount: number
): { isValid: boolean; violations: string[] } {
  const violations: string[] = []
  
  if (!data || !data.items || !Array.isArray(data.items)) {
    violations.push('items配列が存在しません')
    return { isValid: false, violations }
  }
  
  if (data.items.length !== expectedCount) {
    violations.push(`項目数が不一致です: 期待${expectedCount}、実際${data.items.length}`)
  }
  
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    
    if (!item.question || typeof item.question !== 'string') {
      violations.push(`items[${i}]: questionが無効です`)
    }
    
    if (item.status !== 'answered' && item.status !== 'unanswered') {
      violations.push(`items[${i}]: statusが無効です`)
    }
    
    if (!Array.isArray(item.evidence)) {
      violations.push(`items[${i}]: evidenceが配列ではありません`)
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations
  }
}

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

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]
    let item: InterviewItem

    if (data?.items && data.items[i]) {
      const rawItem = data.items[i]
      
      item = {
        question: question,
        answer: rawItem.answer || null,
        status: rawItem.status || 'unanswered',
        evidence: Array.isArray(rawItem.evidence) ? rawItem.evidence : []
      }

      if (item.status === 'answered') {
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

      if (item.status === 'unanswered') {
        item.answer = null
        item.evidence = []
      }
    } else {
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

export function validateEvidence(evidence: string[], transcript: string): boolean {
  if (evidence.length === 0) return false
  
  return evidence.some(ev => {
    if (!ev || ev.trim() === '') return false
    return transcript.includes(ev.trim())
  })
}

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

違反内容:
${validation.violations.map(v => `- ${v}`).join('\n')}

サンプル項目:
${data?.items?.slice(0, 2).map((item: any, i: number) => 
  `[${i}] Q: "${item?.question}" A: "${item?.answer}" S: ${item?.status} E: ${item?.evidence?.length || 0}`
).join('\n')}
=================================
`
}