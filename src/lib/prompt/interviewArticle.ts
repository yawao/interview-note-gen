// インタビュー記事化のためのプロンプト定義
// N-in / N-out と未回答固定の厳格な制約

/**
 * System プロンプト
 * 質問増殖防止と未回答固定を厳命
 */
export const systemPrompt = `あなたは新規事業インタビューの編集者です。以下を厳守してください：

CRITICAL CONSTRAINTS:
- 新規の質問を作成してはならない
- 出力するQブロックの個数・順序は、入力questionsに完全一致させる
- answers.hasEvidenceがfalseの項目は、本文を「未回答」のみとし、推測で埋めない
- 出力はJSONのみ。余計なテキストを含めない

FORBIDDEN ACTIONS (絶対禁止):
- 入力配列に存在しない質問や回答を新規に作成しないこと
- 未回答（空文字）はそのまま空として扱い、補完しないこと
- Qの個数は配列長（最大7）に厳密一致。Q8以降は出力しないこと
- 『質問内容が見つかりません』等のプレースホルダ文言は出力しないこと
- 質問の新規作成・追加・削除・変更
- 「質問内容が見つかりません」などの代替文言
- 推測や常識による回答の補完
- JSON以外の前置き・後置き文章

OUTPUT FORMAT:
- 厳密なJSONスキーマに従う
- blocksの配列長は必ずinput.questions.lengthと一致
- 各blockのorderは input.questions[i].orderと完全対応
- 最大7個のblockまで。それを超える出力は禁止`

/**
 * User プロンプト
 * JSON スキーマとペイロード処理指示
 */
export const userPrompt = `次のJSON（InterviewPayload）に基づいて、Qごとの本文を作成してください。
必要ならcontextは参照可能ですが、質問の新規作成・順序変更は禁止です。

出力は以下JSONスキーマに厳密準拠してください：

{
  "type": "object",
  "properties": {
    "blocks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "order": {"type": "number"},
          "question": {"type": "string"},
          "body": {"type": "string"}
        },
        "required": ["order", "question", "body"],
        "additionalProperties": false
      }
    }
  },
  "required": ["blocks"],
  "additionalProperties": false
}

PROCESSING RULES:
1. answers.hasEvidence === false の場合：body = "未回答" 固定
2. answers.hasEvidence === true の場合：contextを参考に適切な本文を作成
3. blocksの配列長 = questions.length（必須）
4. 各block.orderは対応するquestion.orderと一致

入力データ：`

/**
 * JSON Schema for response format
 * OpenAI response_format で使用
 */
export const interviewArticleSchema = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order: { type: "number" },
          question: { type: "string" },
          body: { type: "string" }
        },
        required: ["order", "question", "body"],
        additionalProperties: false
      }
    }
  },
  required: ["blocks"],
  additionalProperties: false
} as const

/**
 * 検証用：レスポンスの構造確認
 */
export function validateResponseStructure(response: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = []
  
  if (!response || typeof response !== 'object') {
    errors.push('Response is not an object')
    return { isValid: false, errors }
  }
  
  if (!Array.isArray(response.blocks)) {
    errors.push('response.blocks is not an array')
    return { isValid: false, errors }
  }
  
  for (let i = 0; i < response.blocks.length; i++) {
    const block = response.blocks[i]
    
    if (typeof block.order !== 'number') {
      errors.push(`blocks[${i}].order is not a number`)
    }
    
    if (typeof block.question !== 'string') {
      errors.push(`blocks[${i}].question is not a string`)
    }
    
    if (typeof block.body !== 'string') {
      errors.push(`blocks[${i}].body is not a string`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}