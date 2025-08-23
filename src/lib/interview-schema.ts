// スキーマ強制とリペアフロー
// 「回答しているのに未回答になる」誤判定の最終防壁

import { z } from 'zod';
import { InterviewItem, StructuredInterviewSummary } from '@/types';

/**
 * InterviewItem用のZodスキーマ
 */
export const InterviewItemSchema = z.object({
  question: z.string().min(1, "質問は必須です"),
  answer: z.string().nullable(),
  status: z.enum(['answered', 'unanswered']),
  evidence: z.array(z.string())
});

/**
 * StructuredInterviewSummary用のZodスキーマ
 */
export const StructuredInterviewSummarySchema = z.object({
  items: z.array(InterviewItemSchema)
});

/**
 * 厳格なスキーマバリデーション（件数チェック付き）
 */
export function validateInterviewSchema(
  data: any, 
  expectedCount: number
): {
  isValid: boolean;
  errors: string[];
  data?: StructuredInterviewSummary;
} {
  const errors: string[] = [];

  try {
    // 基本構造チェック
    if (!data || typeof data !== 'object') {
      errors.push('データが無効です（非オブジェクト）');
      return { isValid: false, errors };
    }

    if (!Array.isArray(data.items)) {
      errors.push('items配列が存在しません');
      return { isValid: false, errors };
    }

    // 件数チェック
    if (data.items.length !== expectedCount) {
      errors.push(`項目数不一致: 期待${expectedCount}、実際${data.items.length}`);
    }

    // Zodスキーマ検証
    const result = StructuredInterviewSummarySchema.safeParse(data);
    
    if (!result.success) {
      const zodErrors = result.error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      );
      errors.push(...zodErrors);
    }

    // ビジネスロジック検証
    data.items.forEach((item: any, index: number) => {
      if (item.status === 'answered') {
        if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
          errors.push(`Q${index + 1}: answered項目にevidenceが不足`);
        } else {
          // evidenceの最小文字数チェック
          const invalidEvidence = item.evidence.filter((ev: string) => 
            !ev || ev.trim().length < 8
          );
          if (invalidEvidence.length > 0) {
            errors.push(`Q${index + 1}: evidence文字数不足（8文字以上必須）`);
          }
        }
      } else if (item.status === 'unanswered') {
        if (item.answer !== null) {
          errors.push(`Q${index + 1}: unanswered項目でanswerがnullではない`);
        }
        if (item.evidence && item.evidence.length > 0) {
          errors.push(`Q${index + 1}: unanswered項目でevidenceが空でない`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? result.data : undefined
    };

  } catch (error) {
    errors.push(`スキーマ検証エラー: ${error instanceof Error ? error.message : String(error)}`);
    return { isValid: false, errors };
  }
}

/**
 * リペアプロンプト生成
 * スキーマエラーに基づいて修復指示を生成
 */
export function generateRepairPrompt(
  originalData: any,
  errors: string[],
  expectedCount: number,
  originalTranscript: string,
  originalQuestions: string[]
): string {
  const problemSummary = errors.slice(0, 5).join('\n- '); // 最大5個のエラー表示

  return `前回の出力に以下の問題があります。修正してください：

DETECTED PROBLEMS:
- ${problemSummary}

REPAIR REQUIREMENTS:
1. 項目数を必ず ${expectedCount} 個にする
2. answered項目には8文字以上の連続したevidence（transcript原文引用）を必須
3. evidenceが取れない項目は status:"unanswered", answer:null, evidence:[] にする
4. 推測・解釈・要約は絶対禁止。原文からの直接引用のみ
5. 純JSONのみ出力（説明文・前後テキスト禁止）

ORIGINAL DATA (参考):
${JSON.stringify(originalData, null, 1)}

TRANSCRIPT:
${originalTranscript}

QUESTIONS (${expectedCount}個):
${originalQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

修正版を出力してください。必ず ${expectedCount} 個のitemsを含む純JSONで。`;
}

/**
 * JSON抽出とクリーニング
 * LLM出力から純粋なJSON部分だけを抽出
 */
export function extractJsonFromOutput(rawOutput: string): {
  json: string;
  success: boolean;
  error?: string;
} {
  if (!rawOutput || !rawOutput.trim()) {
    return {
      json: '',
      success: false,
      error: '出力が空です'
    };
  }

  try {
    // 方法1: 全体がJSONかチェック
    try {
      JSON.parse(rawOutput);
      return {
        json: rawOutput,
        success: true
      };
    } catch {
      // 全体はJSONではない。部分抽出を試す
    }

    // 方法2: {から}までの最も長いJSON候補を抽出
    const matches = rawOutput.match(/\{[\s\S]*\}/g);
    
    if (!matches || matches.length === 0) {
      return {
        json: '',
        success: false,
        error: 'JSON構造が見つかりません'
      };
    }

    // 最も長いJSONを選択（通常は最も完全なもの）
    const longestMatch = matches.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    );

    // パースチェック
    JSON.parse(longestMatch);

    return {
      json: longestMatch,
      success: true
    };

  } catch (error) {
    return {
      json: '',
      success: false,
      error: `JSON抽出失敗: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * スキーマバリデーション結果の詳細ログ
 */
export function logValidationResult(
  result: ReturnType<typeof validateInterviewSchema>,
  context: string
): void {
  if (result.isValid) {
    console.log(`✅ ${context}: スキーマ検証成功`);
  } else {
    console.log(`❌ ${context}: スキーマ検証失敗`);
    result.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
}

/**
 * JSON Schema形式でのスキーマ定義（OpenAI等でresponse_format指定用）
 */
export const InterviewSummaryJsonSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: ["string", "null"] },
          status: { type: "string", enum: ["answered", "unanswered"] },
          evidence: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["question", "answer", "status", "evidence"],
        additionalProperties: false
      }
    }
  },
  required: ["items"],
  additionalProperties: false
} as const;