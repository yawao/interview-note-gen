// Evidence一致判定の現実化（正規化＋部分一致）
// 「回答しているのに未回答になる」誤判定を防ぐ

/**
 * テキストを実運用レベルで正規化
 * NFKC → 全半角統一 → 空白圧縮 → 句読点統一
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .normalize("NFKC")                    // Unicode正規化（全角/半角統一）
    .replace(/[\s　]+/g, " ")             // 連続空白（全角空白含む）を1個の半角スペースに
    .replace(/[、，]/g, "、")              // カンマ類を読点に統一
    .replace(/[。．]/g, "。")              // ピリオド類を句点に統一
    .replace(/[「『]/g, "「")              // 開きカギ括弧統一
    .replace(/[」』]/g, "」")              // 閉じカギ括弧統一
    .trim();
}

/**
 * Evidence設定（調整可能な定数）
 */
export const EVIDENCE_CONFIG = {
  MIN_LENGTH: parseInt(process.env.EVIDENCE_MIN_LENGTH || '8'),     // 最小文字数
  MAX_LENGTH: parseInt(process.env.EVIDENCE_MAX_LENGTH || '200'),   // 最大文字数（冗長すぎるevidence防止）
  PARTIAL_MATCH: process.env.EVIDENCE_PARTIAL_MATCH !== 'false'    // 部分一致を許可するか
} as const;

/**
 * Evidenceがtranscriptに存在するかを検証
 * 実運用に耐える正規化＋部分一致で判定
 */
export function validateEvidence(evidence: string, transcript: string): boolean {
  if (!evidence || !transcript) {
    console.debug('❌ Evidence検証: 空文字列', { evidence: !!evidence, transcript: !!transcript });
    return false;
  }

  const normalizedEvidence = normalizeText(evidence);
  const normalizedTranscript = normalizeText(transcript);

  // 長さチェック
  if (normalizedEvidence.length < EVIDENCE_CONFIG.MIN_LENGTH) {
    console.debug(`❌ Evidence検証: 短すぎ (${normalizedEvidence.length}文字 < ${EVIDENCE_CONFIG.MIN_LENGTH})`, 
      { evidence: normalizedEvidence });
    return false;
  }

  if (normalizedEvidence.length > EVIDENCE_CONFIG.MAX_LENGTH) {
    console.debug(`❌ Evidence検証: 長すぎ (${normalizedEvidence.length}文字 > ${EVIDENCE_CONFIG.MAX_LENGTH})`, 
      { evidence: normalizedEvidence.substring(0, 50) + '...' });
    return false;
  }

  // 一致判定（部分一致）
  const isMatch = normalizedTranscript.includes(normalizedEvidence);
  
  if (!isMatch) {
    console.debug('❌ Evidence検証: transcript内に未発見', {
      evidence: normalizedEvidence.substring(0, 50),
      transcriptLength: normalizedTranscript.length
    });
  } else {
    console.debug('✅ Evidence検証: 一致', {
      evidence: normalizedEvidence.substring(0, 30),
      matchIndex: normalizedTranscript.indexOf(normalizedEvidence)
    });
  }

  return isMatch;
}

/**
 * 配列内のevidenceをすべて検証
 * 1つでも有効なevidenceがあればtrue
 */
export function validateEvidenceArray(evidences: string[], transcript: string): boolean {
  if (!Array.isArray(evidences) || evidences.length === 0) {
    console.debug('❌ Evidence配列検証: 空配列', { evidences });
    return false;
  }

  const validCount = evidences.filter(ev => validateEvidence(ev, transcript)).length;
  
  console.debug(`🔍 Evidence配列検証: ${validCount}/${evidences.length}件有効`, {
    total: evidences.length,
    valid: validCount
  });

  return validCount > 0;
}

/**
 * Evidence品質の分析（デバッグ用）
 */
export function analyzeEvidenceQuality(evidences: string[], transcript: string): {
  totalCount: number;
  validCount: number;
  tooShort: number;
  tooLong: number;
  notFound: number;
  averageLength: number;
  qualityScore: number; // 0-1の品質スコア
} {
  if (!Array.isArray(evidences)) {
    return {
      totalCount: 0, validCount: 0, tooShort: 0, tooLong: 0, notFound: 0,
      averageLength: 0, qualityScore: 0
    };
  }

  const normalizedTranscript = normalizeText(transcript);
  let validCount = 0;
  let tooShort = 0;
  let tooLong = 0;
  let notFound = 0;
  let totalLength = 0;

  for (const evidence of evidences) {
    const normalizedEvidence = normalizeText(evidence);
    totalLength += normalizedEvidence.length;

    if (normalizedEvidence.length < EVIDENCE_CONFIG.MIN_LENGTH) {
      tooShort++;
    } else if (normalizedEvidence.length > EVIDENCE_CONFIG.MAX_LENGTH) {
      tooLong++;
    } else if (!normalizedTranscript.includes(normalizedEvidence)) {
      notFound++;
    } else {
      validCount++;
    }
  }

  const averageLength = evidences.length > 0 ? Math.round(totalLength / evidences.length) : 0;
  const qualityScore = evidences.length > 0 ? validCount / evidences.length : 0;

  return {
    totalCount: evidences.length,
    validCount,
    tooShort,
    tooLong,
    notFound,
    averageLength,
    qualityScore
  };
}

/**
 * Evidence設定の現在値をログ出力
 */
export function logEvidenceConfig(): void {
  console.log('🔧 Evidence検証設定:', {
    MIN_LENGTH: EVIDENCE_CONFIG.MIN_LENGTH,
    MAX_LENGTH: EVIDENCE_CONFIG.MAX_LENGTH,
    PARTIAL_MATCH: EVIDENCE_CONFIG.PARTIAL_MATCH
  });
}