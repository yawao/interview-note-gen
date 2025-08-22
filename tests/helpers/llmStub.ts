import { StructuredInterviewSummary, InterviewItem } from '@/types'

export type LLMStubMode = 
  | 'normal'           // 正常：質問数ちょうど、answered は evidence あり
  | 'over'             // 超過：質問数+1件を返す  
  | 'under'            // 不足：質問数-1件しか返さない
  | 'answeredNoEvidence' // evidence欠落：answered なのに evidence: []
  | 'nonJSON'          // 非JSON / 余計な前置き：JSON前後に文章付き
  | 'fakeEvidence'     // 偽引用：evidence がトランスクリプトに存在しない
  | 'injection'        // 注入影響：すべて回答しようとする出力
  | 'fuzzy'            // ファジー（プロパティテスト用）

export interface LLMStub {
  (transcription: string, questions: string[]): Promise<{
    structuredSummary: any
    rawOutput: string
    success: boolean
    error?: string
  }>
}

/**
 * 決定的なLLMスタブを作成（シード固定で再現可能）
 */
export function makeLLMStub(mode: LLMStubMode, seed: number = 42): LLMStub {
  // 簡単な疑似乱数生成器（シード固定）
  let randomSeed = seed
  const random = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280
    return randomSeed / 233280
  }

  return async (transcription: string, questions: string[]) => {
    const questionCount = questions.length

    switch (mode) {
      case 'normal': {
        // 正常：質問数ちょうど、根拠のあるものはanswered
        const items: InterviewItem[] = questions.map((question, index) => {
          // transcriptから根拠が見つかるかシミュレート
          const hasEvidence = transcription.toLowerCase().includes('創業') && index === 0 ||
                              transcription.toLowerCase().includes('チーム') && index === 2
          
          if (hasEvidence) {
            const evidence = index === 0 
              ? ['前職でエンジニアとして働いていた時に課題を感じた', '2019年に会社を設立']
              : ['会社のビジョンに共感してくれる人材を重視', '実務テストを導入']
            
            return {
              question,
              answer: `回答${index + 1}: 根拠に基づく内容`,
              status: 'answered' as const,
              evidence
            }
          } else {
            return {
              question,
              answer: null,
              status: 'unanswered' as const,
              evidence: []
            }
          }
        })

        return {
          structuredSummary: { items },
          rawOutput: JSON.stringify({ items }, null, 2),
          success: true
        }
      }

      case 'over': {
        // 超過：質問数+1件返す
        const items: InterviewItem[] = [
          ...questions.map((question, index) => ({
            question,
            answer: `回答${index + 1}`,
            status: 'answered' as const,
            evidence: [`根拠${index + 1}`]
          })),
          {
            question: "余分な質問",
            answer: "余分な回答",
            status: 'answered' as const,
            evidence: ["余分な根拠"]
          }
        ]

        return {
          structuredSummary: { items },
          rawOutput: JSON.stringify({ items }, null, 2),
          success: true
        }
      }

      case 'under': {
        // 不足：質問数-1件しか返さない
        const items: InterviewItem[] = questions.slice(0, -1).map((question, index) => ({
          question,
          answer: `回答${index + 1}`,
          status: 'answered' as const,
          evidence: [`根拠${index + 1}`]
        }))

        return {
          structuredSummary: { items },
          rawOutput: JSON.stringify({ items }, null, 2),
          success: true
        }
      }

      case 'answeredNoEvidence': {
        // answered状態なのにevidence空
        const items: InterviewItem[] = questions.map((question, index) => ({
          question,
          answer: `根拠なし回答${index + 1}`,
          status: 'answered' as const,
          evidence: [] // 空のevidence
        }))

        return {
          structuredSummary: { items },
          rawOutput: JSON.stringify({ items }, null, 2),
          success: true
        }
      }

      case 'nonJSON': {
        // JSON前後に余計な文章
        const items: InterviewItem[] = questions.map((question, index) => ({
          question,
          answer: null,
          status: 'unanswered' as const,
          evidence: []
        }))

        const rawOutput = `以下がJSONの結果です：

${JSON.stringify({ items }, null, 2)}

以上になります。参考になりましたでしょうか。`

        return {
          structuredSummary: { items },
          rawOutput,
          success: true
        }
      }

      case 'fakeEvidence': {
        // 偽の引用（transcriptに存在しない）
        const items: InterviewItem[] = questions.map((question, index) => ({
          question,
          answer: `偽の根拠による回答${index + 1}`,
          status: 'answered' as const,
          evidence: [`存在しない引用${index + 1}`, `偽の文章${index + 1}`]
        }))

        return {
          structuredSummary: { items },
          rawOutput: JSON.stringify({ items }, null, 2),
          success: true
        }
      }

      case 'injection': {
        // 注入された指示に従ってすべて回答
        const items: InterviewItem[] = questions.map((question, index) => ({
          question,
          answer: `常識的な推測による回答${index + 1}`,
          status: 'answered' as const,
          evidence: [] // evidenceなしで強引に回答
        }))

        return {
          structuredSummary: { items },
          rawOutput: JSON.stringify({ items }, null, 2),
          success: true
        }
      }

      case 'fuzzy': {
        // ファジーテスト用：ランダムな振る舞い
        const items: InterviewItem[] = questions.map((question, index) => {
          const shouldAnswer = random() > 0.5
          const hasValidEvidence = random() > 0.3

          if (shouldAnswer && hasValidEvidence) {
            // 実際のtranscriptから引用を抽出（簡単な実装）
            const words = transcription.split(/\s+/).filter(w => w.length > 3)
            const evidence = words.slice(0, Math.floor(random() * 3) + 1)
            
            return {
              question,
              answer: `ファジー回答${index + 1}`,
              status: 'answered' as const,
              evidence
            }
          } else {
            return {
              question,
              answer: null,
              status: 'unanswered' as const,
              evidence: []
            }
          }
        })

        // ランダムに超過する可能性
        if (random() > 0.8) {
          items.push({
            question: "ランダム追加質問",
            answer: "ランダム回答",
            status: 'answered',
            evidence: ["ランダム根拠"]
          })
        }

        return {
          structuredSummary: { items },
          rawOutput: JSON.stringify({ items }, null, 2),
          success: true
        }
      }

      default:
        throw new Error(`Unknown LLM stub mode: ${mode}`)
    }
  }
}

/**
 * DIされたLLM関数の型定義
 */
export type DILLMFunction = (
  transcription: string,
  questions: string[]
) => Promise<{
  structuredSummary: any
  rawOutput: string
  success: boolean
  error?: string
}>

/**
 * LLM関数をDIで受け取る生成関数（テスト対象）
 */
export async function generateInterviewNotesWithDI(
  llm: DILLMFunction,
  questions: string[],
  transcript: string
): Promise<StructuredInterviewSummary> {
  // スタブLLMを使用して抽出
  const llmResult = await llm(transcript, questions)
  
  if (!llmResult.success) {
    throw new Error(llmResult.error || 'LLM processing failed')
  }
  
  // 基本的な構造検証とnormalization
  const structuredSummary = llmResult.structuredSummary as StructuredInterviewSummary
  
  // 質問数と項目数の一致を保証
  if (structuredSummary.items.length !== questions.length) {
    // underflow: 足りない分を補完
    while (structuredSummary.items.length < questions.length) {
      const missingIndex = structuredSummary.items.length
      structuredSummary.items.push({
        question: questions[missingIndex],
        answer: null,
        status: 'unanswered',
        evidence: []
      })
    }
    
    // overflow: 余分な分を削除
    if (structuredSummary.items.length > questions.length) {
      structuredSummary.items = structuredSummary.items.slice(0, questions.length)
    }
  }
  
  // Evidence validation: transcriptに存在しない根拠をfilter
  structuredSummary.items = structuredSummary.items.map(item => {
    if (item.status === 'answered') {
      const validEvidence = item.evidence.filter(evidence => 
        evidence.length === 0 || transcript.includes(evidence)
      )
      
      // 有効な根拠がない場合はunansweredに変更
      if (validEvidence.length === 0) {
        return {
          question: item.question,
          answer: null,
          status: 'unanswered' as const,
          evidence: []
        }
      }
      
      return {
        ...item,
        evidence: validEvidence
      }
    }
    
    return item
  })
  
  return structuredSummary
}