'use client'

import { useState, useEffect } from 'react'
import { Article, Transcription, Question, ArticleType, StructuredInterviewSummary } from '@/types'

interface SummarizerProps {
  projectId: string
  transcription: Transcription
  articleType?: ArticleType
  onArticleComplete: (article: Article) => void
}

export default function Summarizer({ projectId, transcription, articleType, onArticleComplete }: SummarizerProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [article, setArticle] = useState<Article | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [structured, setStructured] = useState<StructuredInterviewSummary | null>(null)

  useEffect(() => {
    // Fetch project questions when component mounts
    const fetchQuestions = async () => {
      try {
        const response = await fetch('/api/projects')
        if (response.ok) {
          const projects = await response.json()
          const currentProject = projects.find((p: any) => p.id === projectId)
          if (currentProject && currentProject.questions) {
            // Sort questions by order
            const sortedQuestions = currentProject.questions.sort((a: Question, b: Question) => a.order - b.order)
            setQuestions(sortedQuestions)
          }
        }
      } catch (err) {
        console.error('Failed to fetch questions:', err)
      }
    }

    fetchQuestions()
  }, [projectId])

  const generateArticle = async () => {
    setIsGenerating(true)
    setError('')

    try {
      // First generate summary (internally)
      const summaryResponse = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      })

      if (!summaryResponse.ok) {
        const summaryError = await summaryResponse.json()
        throw new Error(summaryError.error || '要約の生成に失敗しました')
      }

      // 構造化レスポンスを状態に保存
      const summaryResult = await summaryResponse.json()
      if (summaryResult.structured) {
        setStructured(summaryResult.structured)
      }

      // Then generate article
      const articleResponse = await fetch('/api/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          projectId,
          articleType: articleType || 'BLOG_POST',
          language: 'ja'
        }),
      })

      if (!articleResponse.ok) {
        const articleError = await articleResponse.json()
        throw new Error(articleError.error || '記事の生成に失敗しました')
      }

      const generatedArticle: Article = await articleResponse.json()
      setArticle(generatedArticle)
      onArticleComplete(generatedArticle)
    } catch (err) {
      setError(err instanceof Error ? err.message : '記事の生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadArticle = async (format: 'markdown' | 'txt' | 'docx' | 'pdf') => {
    if (!article) return

    try {
      const response = await fetch(`/api/download/${article.id}?format=${format}`)
      
      if (!response.ok) {
        throw new Error('ダウンロードに失敗しました')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      let filename = article.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')
      switch (format) {
        case 'markdown':
          a.download = `${filename}.md`
          break
        case 'txt':
          a.download = `${filename}.txt`
          break
        case 'docx':
          a.download = `${filename}.docx`
          break
        case 'pdf':
          a.download = `${filename}.pdf`
          break
      }
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ダウンロードに失敗しました')
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">インタビュー記事作成</h2>
      
      {/* Q&A Display */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">インタビュー内容（Q&A）</h3>
        <div className="p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
          <div className="text-sm leading-relaxed">
            {structured ? (
              // NEW: 構造化レスポンス直接描画 (N-in/N-out保証)
              <div className="space-y-4">
                {structured.items.map((item, index) => (
                  <div key={index} className="mb-4">
                    <div className="font-medium text-blue-700 mb-1">
                      Q{index + 1}: {item.question}
                    </div>
                    <div className="text-gray-700 ml-4 whitespace-pre-wrap">
                      {item.answer ?? '未回答'}
                    </div>
                    {item.evidence && item.evidence.length > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        根拠: {item.evidence.map(e => `「${e}」`).join(' / ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // FALLBACK: 構造化データ取得前の表示
              <div className="text-center text-gray-500 py-8">
                <div className="animate-pulse">
                  構造化データを読み込み中...
                </div>
                <div className="text-xs mt-2">
                  記事生成ボタンを押すと、構造化されたQ&Aが表示されます
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Article Generation */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">記事生成</h3>
          {!article && (
            <button
              onClick={generateArticle}
              disabled={isGenerating}
              className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
            >
              {isGenerating ? '記事作成中...' : '記事を作成する'}
            </button>
          )}
        </div>

        {isGenerating && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-green-600 text-lg">GPT-4oでブログ向けインタビュー記事を作成中...</p>
            <p className="text-gray-600 text-sm mt-2">Q&Aを元にタイトル・リード文・見出し構成・まとめを含む完全な記事を生成しています</p>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm mb-4">{error}</div>
        )}

        {article && (
          <div className="border rounded-lg">
            {/* Article Header */}
            <div className="border-b p-4 bg-gray-50">
              <h4 className="text-xl font-bold">{article.title}</h4>
              <p className="text-sm text-gray-600 mt-1">
                生成日: {new Date(article.createdAt).toLocaleDateString('ja-JP')} • 
                フォーマット: {article.format}
              </p>
            </div>

            {/* Article Content */}
            <div className="p-6">
              <div className="prose max-w-none">
                <div 
                  className="whitespace-pre-wrap text-sm bg-white p-4 rounded border leading-relaxed"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {article.content}
                </div>
              </div>
            </div>

            {/* Download Actions */}
            <div className="border-t p-4 bg-gray-50">
              <h5 className="text-sm font-medium text-gray-700 mb-3">ダウンロード形式を選択:</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => downloadArticle('txt')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
                >
                  📄 TXT
                </button>
                <button
                  onClick={() => downloadArticle('markdown')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  📝 Markdown
                </button>
                <button
                  onClick={() => downloadArticle('docx')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
                >
                  📃 Word
                </button>
                <button
                  onClick={() => alert('PDF機能は現在メンテナンス中です')}
                  className="bg-gray-400 text-white px-4 py-2 rounded-md cursor-not-allowed text-sm"
                  disabled
                >
                  📕 PDF (メンテナンス中)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Message */}
      {article && (
        <div className="text-center">
          <div className="text-green-600 text-lg mb-2">
            ✓ インタビュー記事が正常に生成されました！
          </div>
          <p className="text-gray-600 text-sm">
            Q&Aを元にブログ向けの構造化されたインタビュー記事が作成されました。<br/>
            記事タイトル・リード文・H2見出し構成・まとめを含む完全な記事として生成されています。<br/>
            TXT、Markdown、Wordの各形式でダウンロードできます。
          </p>
        </div>
      )}
    </div>
  )
}