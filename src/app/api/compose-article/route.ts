import { NextRequest, NextResponse } from 'next/server'
import { ComposeArticleRequest, ComposeArticleResponse } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body: ComposeArticleRequest = await req.json()
    
    // 入力データの前処理（NFKC正規化、全角/半角統一など）
    const normalizedData = preprocessInputData(body)
    
    // 素材統合：questions/answers/notes を結合してコーパスを作成
    const corpus = buildCorpus(normalizedData.questions, normalizedData.answers, normalizedData.notes || [])
    
    // アウトライン生成：見出し案（H2/H3）
    const outline = await generateOutline(corpus, body.options?.max_sections || 8)
    
    // ドラフト生成：各セクションの本文
    const draft = await generateDraft(outline, corpus)
    
    // 出典推定：各段落に最も寄与した sources と confidence を付与
    const enrichedDraft = await inferSourcesAndConfidence(draft, normalizedData.questions, normalizedData.answers)
    
    // カバレッジ計算：各質問がどの程度記事に反映されているか
    const coverage = computeCoverage(enrichedDraft, normalizedData.questions)
    
    const response: ComposeArticleResponse = {
      outline,
      draft: enrichedDraft,
      coverage
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error in compose-article:', error)
    return NextResponse.json(
      { error: 'Failed to compose article' },
      { status: 500 }
    )
  }
}

/**
 * 入力データの前処理
 */
function preprocessInputData(data: ComposeArticleRequest): ComposeArticleRequest {
  return {
    ...data,
    questions: data.questions.map(q => ({
      ...q,
      text: normalizeText(q.text)
    })),
    answers: data.answers.map(a => ({
      ...a,
      text: normalizeText(a.text)
    })),
    notes: data.notes?.map(n => ({
      ...n,
      text: normalizeText(n.text)
    }))
  }
}

/**
 * テキスト正規化（NFKC、全角/半角統一、改行統一、ゼロ幅文字除去）
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFKC')  // Unicode正規化
    .replace(/\r\n|\r/g, '\n')  // 改行統一
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // ゼロ幅文字除去
    .trim()
}

/**
 * 素材からコーパスを構築
 */
function buildCorpus(
  questions: Array<{ id: string; text: string }>,
  answers: Array<{ qid: string; text: string }>,
  notes: Array<{ id: string; text: string }>
): string {
  const qaText = questions.map(q => {
    const answer = answers.find(a => a.qid === q.id)
    return `Q: ${q.text}\nA: ${answer?.text || ''}`
  }).join('\n\n')
  
  const notesText = notes.map(n => n.text).join('\n\n')
  
  return [qaText, notesText].filter(Boolean).join('\n\n---\n\n')
}

/**
 * アウトライン生成（モック実装）
 */
async function generateOutline(
  corpus: string, 
  maxSections: number
): Promise<Array<{ id: string; title: string }>> {
  // TODO: 実際のLLM呼び出しで実装
  console.log('🔧 アウトライン生成開始', { corpusLength: corpus.length, maxSections })
  
  // モックデータ（開発用）
  const mockOutline = [
    { id: 's1', title: '背景と動機' },
    { id: 's2', title: '取り組みの詳細' },
    { id: 's3', title: '成果と学び' },
    { id: 's4', title: '今後の展望' }
  ]
  
  return mockOutline.slice(0, maxSections)
}

/**
 * ドラフト生成（モック実装）
 */
async function generateDraft(
  outline: Array<{ id: string; title: string }>,
  corpus: string
): Promise<Array<{
  section_id: string;
  html: string;
  sources: string[];
  confidence: number;
}>> {
  // TODO: 実際のLLM呼び出しで実装
  console.log('🔧 ドラフト生成開始', { sections: outline.length, corpusLength: corpus.length })
  
  // モックデータ（開発用）
  return outline.map((section, index) => {
    const confidences = [0.85, 0.72, 0.45, 0.33]
    const mockSources = index < 2 ? [`Q${index + 1}`, `Q${index + 2}`] : []
    
    return {
      section_id: section.id,
      html: `<p>${section.title}についての詳細な内容がここに生成されます。</p><p>結論から根拠、具体例の順で構成された本文が作成されます。</p>`,
      sources: mockSources,
      confidence: confidences[index] || 0.3
    }
  })
}

/**
 * 出典推定とconfidence算出
 */
async function inferSourcesAndConfidence(
  draft: Array<{
    section_id: string;
    html: string;
    sources: string[];
    confidence: number;
  }>,
  questions: Array<{ id: string; text: string }>,
  answers: Array<{ qid: string; text: string }>
): Promise<Array<{
  section_id: string;
  html: string;
  sources: string[];
  confidence: number;
}>> {
  // TODO: より精密な出典推定ロジックを実装
  console.log('🔧 出典推定開始', { draftSections: draft.length, questionsCount: questions.length })
  
  // 現在はモックデータをそのまま返す
  return draft
}

/**
 * カバレッジ計算
 */
function computeCoverage(
  draft: Array<{
    section_id: string;
    html: string;
    sources: string[];
    confidence: number;
  }>,
  questions: Array<{ id: string; text: string }>
): Record<string, number> {
  console.log('🔧 カバレッジ計算開始')
  
  const coverage: Record<string, number> = {}
  
  // 各質問について、記事でどの程度カバーされているかを計算
  questions.forEach(question => {
    let maxCoverage = 0
    
    draft.forEach(section => {
      if (section.sources.includes(question.id)) {
        maxCoverage = Math.max(maxCoverage, section.confidence)
      }
    })
    
    coverage[question.id] = maxCoverage
  })
  
  return coverage
}