// テキストサニタイズ（保険）
// 見出し・箇条書き・Q+番号パターンの除去

/**
 * 生テキストから見出しや箇条書きを除去
 * LLMの入力汚染防止用（保険）
 */
export function stripHeadingsAndBullets(src: string): string {
  const lines = src.split(/\r?\n/)
  
  // 除去パターン
  const patterns = [
    /^Q\d+\s*[:：]/,           // Q1: Q2: など
    /^[#＃].*$/,              // Markdown見出し
    /^[0-9０-９]+\.\s+/,       // 1. 2. などの番号付きリスト
    /^[-–—・]\s+/,            // ハイフンや中点の箇条書き
    /^[①②③④⑤⑥⑦⑧⑨⑩]/,      // 丸数字
    /^[（\(]\d+[）\)]/,       // (1) (2) など
  ]
  
  return lines
    .filter(line => {
      const trimmed = line.trim()
      if (!trimmed) return true // 空行は保持
      
      return !patterns.some(pattern => pattern.test(trimmed))
    })
    .join('\n')
}

/**
 * より強力なクリーニング
 * LLMが誤認識しやすいパターンを徹底除去
 */
export function aggressiveClean(src: string): string {
  let cleaned = src
  
  // Q+数字パターンの完全除去
  cleaned = cleaned.replace(/Q\d+[:\s：]*.*$/gm, '')
  
  // 「質問内容が見つかりません」の除去
  cleaned = cleaned.replace(/質問内容が見つかりません/g, '')
  
  // 連続する空行を単一化
  cleaned = cleaned.replace(/\n\n+/g, '\n\n')
  
  // 前後の空白をトリム
  cleaned = cleaned.trim()
  
  return cleaned
}

/**
 * デバッグ用：除去されたパターンのレポート
 */
export function analyzePatternsFound(src: string): {
  qNumbers: number;
  headings: number;
  bullets: number;
  circledNumbers: number;
} {
  const lines = src.split(/\r?\n/)
  
  let qNumbers = 0
  let headings = 0
  let bullets = 0
  let circledNumbers = 0
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    if (/^Q\d+\s*[:：]/.test(trimmed)) qNumbers++
    if (/^[#＃]/.test(trimmed)) headings++
    if (/^[-–—・]\s+/.test(trimmed)) bullets++
    if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(trimmed)) circledNumbers++
  }
  
  return { qNumbers, headings, bullets, circledNumbers }
}