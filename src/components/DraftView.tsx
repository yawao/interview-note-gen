'use client'

import { useState, useEffect, useCallback } from 'react'
import { Question, ComposeArticleResponse, ArticleDraftSection } from '@/types'
import { getBadgeTone, getBadgeLabel } from '@/constants/confidence'

interface DraftViewProps {
  projectId: string
}

export default function DraftView({ projectId }: DraftViewProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [draftData, setDraftData] = useState<ComposeArticleResponse | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'markdown' | 'docx'>('pdf')

  const fetchQuestions = useCallback(async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const projects = await response.json()
        const currentProject = projects.find((p: any) => p.id === projectId)
        if (currentProject?.questions) {
          const sortedQuestions = currentProject.questions.sort((a: Question, b: Question) => a.order - b.order)
          setQuestions(sortedQuestions)
        }
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err)
    }
  }, [projectId])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const generateDraft = async () => {
    setIsGenerating(true)
    setError('')

    try {
      // 実際のAPIを呼び出す
      const response = await fetch('/api/compose-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: questions.map(q => ({ id: q.id, text: q.content })),
          answers: questions.map(q => ({ qid: q.id, text: '' })), // TODO: 実際の回答データを取得
          notes: [], // TODO: 実際のメモデータ
          options: { normalize: true, max_sections: 8 }
        })
      })

      if (!response.ok) {
        throw new Error('記事生成APIの呼び出しに失敗しました')
      }

      const result: ComposeArticleResponse = await response.json()
      setDraftData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft生成に失敗しました')
    } finally {
      setIsGenerating(false)
    }
  }

  const renderSourceBadge = (section: ArticleDraftSection) => {
    const tone = getBadgeTone(section.confidence, section.sources)
    const label = getBadgeLabel(section.confidence, section.sources)
    
    const colors = {
      green: 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100',
      gray: 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
    }

    const icons = {
      green: '✓',
      yellow: '⚠',
      gray: '○'
    }

    return (
      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          {section.sources.length > 0 && (
            <div className="text-xs text-gray-500">
              出典: {section.sources.join(', ')}
            </div>
          )}
        </div>
        <div 
          className={`
            inline-flex items-center px-2 py-1 text-xs font-medium border rounded-full 
            cursor-help transition-colors duration-200 ${colors[tone]}
          `}
          title={`${label} (信頼度: ${Math.round(section.confidence * 100)}%)`}
        >
          <span className="mr-1">{icons[tone]}</span>
          <span>
            {tone === 'green' && '出典十分'}
            {tone === 'yellow' && '要確認'}
            {tone === 'gray' && '下書き'}
          </span>
        </div>
      </div>
    )
  }

  const handleExport = (format: 'pdf' | 'markdown' | 'docx') => {
    if (!draftData) return
    
    // 出典なし・信頼度低の段落数をチェック
    const lowConfidenceSections = draftData.draft.filter(
      section => section.confidence < 0.4 || section.sources.length === 0
    )
    
    if (lowConfidenceSections.length > 0) {
      setExportFormat(format)
      setShowExportDialog(true)
    } else {
      // 直接エクスポート
      performExport(format)
    }
  }

  const performExport = async (format: 'pdf' | 'markdown' | 'docx') => {
    if (!draftData) return
    
    try {
      // TODO: 実際のエクスポートAPI呼び出し
      console.log(`Exporting as ${format}...`)
      alert(`${format.toUpperCase()}形式でのエクスポートを開始します`)
    } catch (error) {
      console.error('Export failed:', error)
      setError('エクスポートに失敗しました')
    }
  }

  const renderExportDialog = () => {
    if (!showExportDialog || !draftData) return null
    
    const lowConfidenceSections = draftData.draft.filter(
      section => section.confidence < 0.4 || section.sources.length === 0
    )
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">エクスポート確認</h3>
          
          <div className="mb-4">
            <p className="text-gray-700 mb-2">
              以下の段落で出典情報が不足している可能性があります：
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-32 overflow-y-auto">
              {lowConfidenceSections.map((section, index) => {
                const outlineSection = draftData.outline.find(o => o.id === section.section_id)
                return (
                  <div key={section.section_id} className="text-sm text-yellow-700 mb-1">
                    • {outlineSection?.title || `セクション ${index + 1}`}
                    {section.sources.length === 0 ? ' (出典なし)' : ` (信頼度${Math.round(section.confidence * 100)}%)`}
                  </div>
                )
              })}
            </div>
          </div>
          
          <p className="text-gray-600 text-sm mb-6">
            このままエクスポートを続行しますか？
          </p>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowExportDialog(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={() => {
                setShowExportDialog(false)
                performExport(exportFormat)
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              続行
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ツールバー */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">記事ドラフト</h2>
          <div className="flex space-x-3">
            <button
              onClick={generateDraft}
              disabled={isGenerating}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? '生成中...' : 'ドラフト生成'}
            </button>
            
            {draftData && (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleExport('markdown')}
                  className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm"
                  title="Markdown形式でエクスポート"
                >
                  📝 MD
                </button>
                <button
                  onClick={() => handleExport('docx')}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 text-sm"
                  title="Word形式でエクスポート"
                >
                  📃 Word
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 text-sm"
                  title="PDF形式でエクスポート"
                >
                  📕 PDF
                </button>
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="text-red-600 text-sm mt-2">{error}</div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 素材パネル (左側) */}
        <div className="col-span-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold mb-4">素材</h3>
            
            {/* 質問・回答 */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">質問・回答</h4>
              {questions.map((q, index) => (
                <div key={q.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-700 mb-1">
                        Q{index + 1}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">{q.content}</div>
                      <div className="text-sm text-gray-500 italic">
                        {/* TODO: 実際の回答データを表示 */}
                        [回答データ取得中...]
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      defaultChecked 
                      className="ml-2 mt-1"
                      title="記事に含める"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* メインエディタエリア (右側) */}
        <div className="col-span-8">
          {isGenerating && (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-blue-600 text-lg">記事ドラフトを生成中...</p>
              <p className="text-gray-600 text-sm mt-2">素材からアウトライン・本文・出典情報を作成しています</p>
            </div>
          )}

          {draftData && (
            <div className="space-y-6">
              {/* アウトライン */}
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="font-semibold mb-4">アウトライン</h3>
                <div className="space-y-2">
                  {draftData.outline.map((section, index) => (
                    <div key={section.id} className="flex items-center">
                      <span className="text-sm text-gray-500 w-8">H{index + 2}</span>
                      <span className="text-sm">{section.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ドラフト本文 */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">本文ドラフト</h3>
                </div>
                <div className="p-4 space-y-6">
                  {draftData.draft.map((section) => {
                    const outlineSection = draftData.outline.find(o => o.id === section.section_id)
                    return (
                      <div key={section.section_id} className="border rounded-lg p-4">
                        <h4 className="text-lg font-semibold mb-3 text-gray-800">
                          {outlineSection?.title}
                        </h4>
                        <div 
                          className="prose text-sm leading-relaxed text-gray-700"
                          dangerouslySetInnerHTML={{ __html: section.html }}
                        />
                        {renderSourceBadge(section)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* カバレッジ情報 */}
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="font-semibold mb-3">素材カバレッジ</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(draftData.coverage).map(([qid, score]) => (
                    <div key={qid} className="flex justify-between">
                      <span>{qid}:</span>
                      <span className={score > 0.7 ? 'text-green-600' : score > 0.4 ? 'text-yellow-600' : 'text-gray-500'}>
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!isGenerating && !draftData && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
              <p className="text-gray-500">「ドラフト生成」ボタンを押して記事の作成を開始してください</p>
            </div>
          )}
        </div>
      </div>
      
      {/* エクスポート確認ダイアログ */}
      {renderExportDialog()}
    </div>
  )
}