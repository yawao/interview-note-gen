import type { StructuredArticle } from '@/types/article'

const WL = ['導入','背景と課題','事例/分析','まとめ','FAQ','CTA'] as const
const REQUIRED = ['導入','背景と課題','まとめ'] as const

export function renderMarkdownFromStructured(a: StructuredArticle): string {
  // 1) ホワイトリストにない見出しは落とす／近似名を丸める
  const normalizeH2 = (h2: string) => {
    if (WL.includes(h2 as any)) return h2
    // 既存の章名に寄せる簡易ルール
    if (/MVP|PoC/.test(h2)) return '事例/分析'
    if (/FAQ/i.test(h2)) return 'FAQ'
    if (/CTA/i.test(h2)) return 'CTA'
    if (/背景|課題/.test(h2)) return '背景と課題'
    if (/導入|はじめ/.test(h2)) return '導入'
    if (/まとめ|結論/.test(h2)) return 'まとめ'
    return '事例/分析'
  }
  const dedupMap = new Map<string, string[]>()
  for (const sec of (a.sections || [])) {
    const h2 = normalizeH2(sec.h2)
    const body = (sec.body || '').trim()
    if (!body) continue
    const arr = dedupMap.get(h2) || []
    arr.push(body)
    dedupMap.set(h2, arr)
  }

  // 2) 章順を固定（導入→背景→事例/分析→まとめ→FAQ→CTA）
  const order = ['導入','背景と課題','事例/分析','まとめ'] as const
  const parts: string[] = []
  for (const key of order) {
    let body = (dedupMap.get(key)?.join('\n\n') || '').trim()
    if (!body && (REQUIRED as readonly string[]).includes(key)) {
      body = 'この点は未回答'
    }
    if (body.split(/[。．!！?？]\s*/).filter(Boolean).length < 2) {
      // 1文未満はスキップ（または近接章へマージするなどの実装も可）
      if (!body) continue
      body = body + '。'
    }
    parts.push(`## ${key}\n${body}`)
  }

  // 3) FAQ/CTA は末尾・各1回
  if (a.faq && a.faq.length > 0) {
    const uniqFaq = a.faq.slice(0, 6) // 上限
    const faqMd = uniqFaq.map(qa => `**Q:** ${qa.q}\n**A:** ${qa.a}`).join('\n\n')
    parts.push(`## FAQ\n${faqMd}`)
  }
  if (a.cta && a.cta.trim()) {
    parts.push(`## CTA\n${a.cta.trim()}`)
  }

  return parts.join('\n\n')
}

// LLMの取りこぼしを最後に機械的に片付ける軽量ガード
export function finalGuard(md: string): string {
  let out = md
  // 本文中 "## " の行頭昇格
  out = out.replace(/([^\n])\s*##\s+(?=\S)/g, '$1\n\n## ')
  // 連続H2の間に空行
  out = out.replace(/(##\s+[^\n]+)\n(##\s+)/g, '$1\n\n$2')
  // 空セクション削除
  out = out.replace(/##\s+[^\n]+\n\s*(?=##\s+)/g, '')
  // FAQ/CTA の多重を末尾の1つに統合
  const keepLast = (label: 'FAQ'|'CTA') => {
    const re = new RegExp(`(?:^|\\n)##\\s+${label}[\\s\\S]*?(?=(?:\\n##\\s+|$))`, 'g')
    const matches: RegExpMatchArray[] = []
    let match
    while ((match = re.exec(out)) !== null) {
      matches.push(match)
    }
    if (matches.length > 1) {
      const last = matches[matches.length - 1][0]
      out = out.replace(re, '') + `\n\n${last.trim()}\n`
    }
  }
  keepLast('FAQ')
  keepLast('CTA')
  // FAQ→CTA 順に末尾へ
  const faq = out.match(/(?:^|\n)##\s+FAQ[\s\S]*?(?=(?:\n##\s+|$))/)
  const cta = out.match(/(?:^|\n)##\s+CTA[\s\S]*?(?=(?:\n##\s+|$))/)
  if (faq || cta) {
    out = out.replace(/(?:^|\n)##\s+FAQ[\s\S]*?(?=(?:\n##\s+|$))/g, '')
             .replace(/(?:^|\n)##\s+CTA[\s\S]*?(?=(?:\n##\s+|$))/g, '')
             .trim()
    out += `\n\n${(faq?.[0] ?? '').trim()}\n\n${(cta?.[0] ?? '').trim()}\n`.replace(/\n{3,}/g, '\n\n')
  }
  return out.replace(/\n{3,}/g, '\n\n').trim()
}