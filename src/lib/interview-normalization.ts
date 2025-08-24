// インタビュー要約の正規化とバリデーション
// 「回答しているのに未回答になる」誤判定の根本解決

import { InterviewItem, StructuredInterviewSummary, Question } from '@/types'
import { validateEvidenceArray, analyzeEvidenceQuality } from './evidence-validation'

export interface NormalizeInput {
  items: InterviewItem[];
  questions: Question[];
  transcript: string;
  strictEvidence?: boolean;
}

export interface NormalizeOutput {
  items: InterviewItem[];
  metadata: {
    originalCount: number;
    finalCount: number;
    answeredCount: number;
    unansweredCount: number;
    downgradedCount: number;
    evidenceQualityScore: number;
  };
}

/**
 * Interview summaryを厳格に正規化
 * - items.length を questions.length に厳密一致
 * - status:"answered" は evidence.length >= 1 を必須
 * - evidenceがtranscriptに一致しない場合はダウンシフト
 */
export function normalizeInterviewSummary({
  items,
  questions,
  transcript,
  strictEvidence = true
}: NormalizeInput): NormalizeOutput {
  console.log('🔧 Interview Summary正規化開始');
  console.log(`- 入力items: ${items.length}件`);
  console.log(`- 期待質問数: ${questions.length}件`);

  const N = questions.length;
  let downgradedCount = 0;
  let totalEvidenceQuality = 0;

  // 1) 件数調整: 超過は切り捨て、不足はunansweredでパディング
  const trimmed = items.slice(0, N);
  while (trimmed.length < N) {
    const missingIndex = trimmed.length;
    const question = questions[missingIndex];
    trimmed.push({
      question: question?.content || `質問${missingIndex + 1}`,
      answer: null,
      status: 'unanswered',
      evidence: []
    });
  }

  console.log(`✅ 件数調整完了: ${trimmed.length}件`);

  // 2) 各itemを厳格検証・ダウンシフト
  const normalized = trimmed.map((item, index) => {
    const questionId = questions[index]?.id || `q_${index + 1}`;
    
    // unansweredは正規化のみ
    if (item.status !== 'answered') {
      return {
        ...item,
        status: 'unanswered' as const,
        answer: null,
        evidence: []
      };
    }

    // answered項目の厳格検証（strictEvidenceがtrueの場合のみ）
    if (strictEvidence) {
      const hasEvidence = Array.isArray(item.evidence) && item.evidence.length > 0;
      if (!hasEvidence) {
        console.debug(`❌ Q${index + 1}: evidence配列が空 → unansweredへダウンシフト`);
        downgradedCount++;
        return {
          ...item,
          status: 'unanswered' as const,
          answer: null,
          evidence: []
        };
      }
    }

    // Evidence品質分析（strictEvidenceがtrueの場合のみ）
    if (strictEvidence) {
      const quality = analyzeEvidenceQuality(item.evidence, transcript);
      totalEvidenceQuality += quality.qualityScore;

      // Evidence一致検証
      const evidenceValid = validateEvidenceArray(item.evidence, transcript);
      if (!evidenceValid) {
        console.debug(`❌ Q${index + 1}: evidence検証失敗 → unansweredへダウンシフト`, {
          evidenceCount: item.evidence.length,
          quality: Math.round(quality.qualityScore * 100) + '%'
        });
        downgradedCount++;
        return {
          ...item,
          status: 'unanswered' as const,
          answer: null,
          evidence: []
        };
      }
      
      console.debug(`✅ Q${index + 1}: evidence検証成功`, {
        evidenceCount: item.evidence.length,
        quality: Math.round(quality.qualityScore * 100) + '%'
      });
    } else {
      console.debug(`✅ Q${index + 1}: strictEvidence=false のため検証スキップ`);
    }

    return {
      ...item,
      status: 'answered' as const
      // answerとevidenceはそのまま保持
    };
  });

  const answeredCount = normalized.filter(item => item.status === 'answered').length;
  const unansweredCount = N - answeredCount;
  const averageEvidenceQuality = N > 0 ? totalEvidenceQuality / N : 0;

  console.log('✅ Interview Summary正規化完了', {
    finalCount: N,
    answeredCount,
    unansweredCount,
    downgradedCount,
    evidenceQualityScore: Math.round(averageEvidenceQuality * 100) + '%'
  });

  return {
    items: normalized,
    metadata: {
      originalCount: items.length,
      finalCount: N,
      answeredCount,
      unansweredCount,
      downgradedCount,
      evidenceQualityScore: averageEvidenceQuality
    }
  };
}

/**
 * 正規化結果の品質検証
 */
export function validateNormalizationResult(result: NormalizeOutput, expectedCount: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 件数チェック
  if (result.items.length !== expectedCount) {
    errors.push(`件数不一致: 期待${expectedCount}、実際${result.items.length}`);
  }

  // answered項目のevidence必須チェック
  const answeredWithoutEvidence = result.items.filter(item => 
    item.status === 'answered' && (!item.evidence || item.evidence.length === 0)
  );
  
  if (answeredWithoutEvidence.length > 0) {
    errors.push(`answered項目でevidence欠如: ${answeredWithoutEvidence.length}件`);
  }

  // unanswered項目の正規化チェック
  const unansweredWithAnswer = result.items.filter(item =>
    item.status === 'unanswered' && item.answer !== null
  );

  if (unansweredWithAnswer.length > 0) {
    errors.push(`unanswered項目でanswer非null: ${unansweredWithAnswer.length}件`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * デバッグ用: 正規化プロセスの詳細ログ
 */
export function logNormalizationDetails(input: NormalizeInput, output: NormalizeOutput): void {
  console.group('📊 Interview Summary正規化 詳細');
  
  console.log('入力統計:', {
    items: input.items.length,
    questions: input.questions.length,
    transcriptLength: input.transcript.length
  });

  console.log('出力統計:', output.metadata);

  // 項目別の詳細
  output.items.forEach((item, index) => {
    console.log(`Q${index + 1}:`, {
      status: item.status,
      hasAnswer: !!item.answer,
      evidenceCount: item.evidence?.length || 0,
      answerLength: item.answer?.length || 0
    });
  });

  console.groupEnd();
}