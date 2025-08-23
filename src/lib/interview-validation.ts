// N-in / N-out バリデーション & 正規化
// 質問数の厳密制御と未回答項目の「未回答」固定

import { InterviewPayload, InterviewBlock } from '@/types/interview'

/**
 * LLM出力を受けて、質問数制御とバリデーションを行う
 * 入力質問数 = 出力ブロック数 を厳密に保証
 */
export function clampAndNormalizeBlocks(
  payload: InterviewPayload,
  generated: InterviewBlock[]
): InterviewBlock[] {
  console.log('🔧 バリデーション開始')
  console.log(`- 期待質問数: ${payload.questions.length}`)
  console.log(`- LLM出力数: ${generated.length}`)
  
  // order昇順で正規化
  const orderedQs = [...payload.questions].sort((a, b) => a.order - b.order)
  const byOrder = new Map<number, {text: string; hasEvidence: boolean}>()
  const ansByQ = new Map(payload.answers.map(a => [a.questionId, a]))

  for (const q of orderedQs) {
    const ans = ansByQ.get(q.id)
    byOrder.set(q.order, { 
      text: q.text, 
      hasEvidence: !!ans?.hasEvidence && !!ans?.text?.trim()
    })
  }

  // LLM出力を order -> block に写像しつつ、不整合は修正
  const picked: InterviewBlock[] = []
  for (const q of orderedQs) {
    const fromModel = generated.find(b => b.order === q.order)
    const hasEvidence = byOrder.get(q.order)!.hasEvidence
    
    let body: string
    if (!hasEvidence) {
      // 根拠なし項目は強制的に「未回答」
      body = "未回答"
    } else {
      // 根拠あり項目でもLLMが空文字や不適切な内容を返した場合は「未回答」
      body = fromModel?.body?.trim() || "未回答"
      if (body === "" || body.includes("質問内容が見つかりません")) {
        body = "未回答"
      }
    }
    
    picked.push({
      order: q.order,
      question: q.text,
      body: body
    })
  }
  
  console.log(`✅ 正規化完了: ${picked.length}ブロック（= ${payload.questions.length}質問）`)
  return picked // 長さは常に questions.length
}

/**
 * 既存のバリデーション関数との互換性維持
 * 従来のStructuredInterviewSummaryとの連携用
 */
export function validateQuestionCount(
  questions: string[],
  blocks: InterviewBlock[]
): { isValid: boolean; message?: string } {
  if (blocks.length !== questions.length) {
    return {
      isValid: false,
      message: `質問数不一致: 期待${questions.length}、実際${blocks.length}`
    }
  }
  
  return { isValid: true }
}

/**
 * 未回答項目の検証
 * hasEvidence=false の項目が適切に「未回答」になっているか確認
 */
export function validateUnansweredBlocks(
  payload: InterviewPayload,
  blocks: InterviewBlock[]
): { isValid: boolean; violations: string[] } {
  const violations: string[] = []
  const ansByQ = new Map(payload.answers.map(a => [a.questionId, a]))
  
  for (const block of blocks) {
    const question = payload.questions.find(q => q.order === block.order)
    if (!question) continue
    
    const answer = ansByQ.get(question.id)
    const hasEvidence = !!answer?.hasEvidence && !!answer?.text?.trim()
    
    if (!hasEvidence && block.body !== "未回答") {
      violations.push(`Q${block.order}: 根拠なしなのに「${block.body}」が設定されている`)
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations
  }
}

// 既存のopenai.tsとの互換性維持のため、旧関数を残す
export * from './interview-validation-legacy'