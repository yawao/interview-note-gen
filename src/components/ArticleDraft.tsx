'use client'

import { useState } from 'react'
import { Article, Summary, ArticleType } from '@/types'

interface ArticleDraftProps {
  projectId: string
  summary: Summary
  articleType?: ArticleType
  onArticleGenerated: (article: Article) => void
}

export default function ArticleDraft({ projectId, summary, articleType, onArticleGenerated }: ArticleDraftProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [article, setArticle] = useState<Article | null>(null)

  const generateArticle = async () => {
    setIsGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/draft', {
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

      if (!response.ok) {
        throw new Error('Failed to generate article draft')
      }

      const generatedArticle: Article = await response.json()
      setArticle(generatedArticle)
      onArticleGenerated(generatedArticle)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate article')
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
      <h2 className="text-2xl font-bold mb-6">記事ドラフト</h2>
      
      {/* Summary Reference */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">要約に基づく</h3>
        <div className="p-4 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap">{summary.content.substring(0, 200)}...</p>
        </div>
      </div>

      {/* Article Generation */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">生成された記事</h3>
          {!article && (
            <button
              onClick={generateArticle}
              disabled={isGenerating}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? '記事生成中...' : '記事ドラフトを生成'}
            </button>
          )}
        </div>

        {isGenerating && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-green-600 text-lg">GPT-4oで記事ドラフトを作成中...</p>
            <p className="text-gray-600 text-sm mt-2">しばらくお待ちください</p>
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
                  onClick={() => downloadArticle('pdf')}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
                >
                  📕 PDF
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
            ✓ 記事ドラフトが正常に生成されました！
          </div>
          <p className="text-gray-600 text-sm">
            インタビューが構造化された記事に変換されました。
            TXT、Markdown、Word、PDFの各形式でダウンロードできます。
          </p>
        </div>
      )}
    </div>
  )
}