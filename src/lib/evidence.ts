import { normalizeText } from './interview-validation'

/**
 * transcript内にevidenceが存在するかを検証。
 * - evidenceは string または string[] を許容
 * - 厳格条件: 文字数 >= 8（短すぎは無効）
 * - 正規化後に包含判定
 */
export function validateEvidence(evidence: string | string[], transcript: string): boolean {
  if (!transcript) return false
  const t = normalizeText(transcript)
  const arr = Array.isArray(evidence) ? evidence : [evidence]
  if (!arr.length) return false

  for (const ev of arr) {
    const e = normalizeText(ev || '')
    if (e.length < 8) return false
    if (t.indexOf(e) === -1) return false
  }
  return true
}

export type EvidenceAnalysis = {
  totalCount: number
  validCount: number
  tooShort: number
  notFound: number
  qualityScore: number // 0..1
}

/** 複数 evidence を解析（テスト期待に合わせたカウント） */
export function analyzeEvidence(evidences: string[], transcript: string): EvidenceAnalysis {
  const t = normalizeText(transcript || '')
  let total = 0, valid = 0, tooShort = 0, notFound = 0

  const seen = new Set<string>()
  const rawList = Array.isArray(evidences) ? evidences : []
  for (const raw of rawList) {
    const e = normalizeText(raw || '')
    if (!e) continue
    if (seen.has(e)) continue      // ★ 重複スキップ
    seen.add(e)

    total++
    if (e.length < 8) { tooShort++; continue }
    if (t.indexOf(e) === -1) { notFound++; continue }
    valid++
  }
  const quality = total ? valid / total : 0
  return { totalCount: total, validCount: valid, tooShort, notFound, qualityScore: quality }
}