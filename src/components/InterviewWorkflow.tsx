'use client'

import { useState } from 'react'
import { Project, Question, Transcription, Summary, Article } from '@/types'
import InterviewSetup from './InterviewSetup'
import InteractiveInterview from './InteractiveInterview'
import Summarizer from './Summarizer'
import ArticleDraft from './ArticleDraft'

type WorkflowStep = 'setup' | 'record' | 'analyze' | 'draft' | 'complete'

export default function InterviewWorkflow() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('setup')
  const [project, setProject] = useState<Project | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [combinedTranscription, setCombinedTranscription] = useState<Transcription | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [article, setArticle] = useState<Article | null>(null)

  const handleProjectCreated = (newProject: Project) => {
    setProject(newProject)
  }

  const handleQuestionsGenerated = (newQuestions: Question[]) => {
    setQuestions(newQuestions)
    setCurrentStep('record')
  }

  const handleInterviewComplete = async (newTranscriptions: Transcription[]) => {
    setTranscriptions(newTranscriptions)
    
    // Use the already combined text from InteractiveInterview that includes follow-up questions
    const combinedText = newTranscriptions
      .map(t => t.text)
      .join('\n\n')
    
    try {
      // Save combined transcription to database
      const response = await fetch('/api/transcribe-combined', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project!.id,
          text: combinedText,
        }),
      })

      if (response.ok) {
        const savedCombined: Transcription = await response.json()
        setCombinedTranscription(savedCombined)
      } else {
        // Fallback to local object if API fails
        const combined: Transcription = {
          id: 'combined',
          audioUrl: 'combined',
          text: combinedText,
          projectId: project!.id,
          createdAt: new Date()
        }
        setCombinedTranscription(combined)
      }
    } catch (error) {
      console.error('Error saving combined transcription:', error)
      // Fallback to local object
      const combined: Transcription = {
        id: 'combined',
        audioUrl: 'combined',
        text: combinedText,
        projectId: project!.id,
        createdAt: new Date()
      }
      setCombinedTranscription(combined)
    }
    
    setCurrentStep('analyze')
  }

  const handleArticleGenerated = (newArticle: Article) => {
    setArticle(newArticle)
    setCurrentStep('complete')
  }

  const resetWorkflow = () => {
    setCurrentStep('setup')
    setProject(null)
    setQuestions([])
    setTranscriptions([])
    setCombinedTranscription(null)
    setSummary(null)
    setArticle(null)
  }

  const canNavigateToStep = (targetStep: WorkflowStep): boolean => {
    switch (targetStep) {
      case 'setup':
        return true // Always can go back to setup
      case 'record':
        return project !== null && questions.length > 0
      case 'analyze':
        return project !== null && combinedTranscription !== null
      case 'draft':
        return project !== null && article !== null // Changed to check article instead of summary
      case 'complete':
        return project !== null && article !== null
      default:
        return false
    }
  }

  const handleStepClick = (targetStep: WorkflowStep) => {
    if (canNavigateToStep(targetStep)) {
      setCurrentStep(targetStep)
    }
  }

  const renderSteps = () => {
    const steps = [
      { key: 'setup', label: 'Setup', icon: '📝' },
      { key: 'record', label: 'Record', icon: '🎤' },
      { key: 'analyze', label: 'Analyze', icon: '🔍' },
      { key: 'draft', label: 'Draft', icon: '📄' },
      { key: 'complete', label: 'Complete', icon: '✅' },
    ] as const

    return (
      <div className="w-full mb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center items-center gap-2 lg:gap-4">
            {steps.map((step, index) => {
              const isActive = step.key === currentStep
              const isCompleted = steps.findIndex(s => s.key === currentStep) > index
              const canNavigate = canNavigateToStep(step.key)
              
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handleStepClick(step.key)}
                      disabled={!canNavigate}
                      className={`
                        flex items-center justify-center w-12 h-12 rounded-full text-lg transition-all duration-200 mb-2
                        ${isActive 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : isCompleted 
                            ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer' 
                            : canNavigate
                              ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                        ${canNavigate && !isActive ? 'hover:scale-105' : ''}
                      `}
                      title={canNavigate ? `${step.label}に移動` : `${step.label}は利用できません`}
                    >
                      {step.icon}
                    </button>
                    <div className="text-xs font-medium text-center whitespace-nowrap">
                      {step.label}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      w-6 lg:w-8 h-0.5 mx-2 lg:mx-4 mt-[-20px] transition-all duration-200
                      ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'setup':
        return (
          <InterviewSetup
            onProjectCreated={handleProjectCreated}
            onQuestionsGenerated={handleQuestionsGenerated}
          />
        )
      
      case 'record':
        if (!project) return null
        return (
          <InteractiveInterview
            questions={questions}
            projectId={project.id}
            onInterviewComplete={handleInterviewComplete}
          />
        )
      
      case 'analyze':
        if (!project || !combinedTranscription) return null
        return (
          <Summarizer
            projectId={project.id}
            transcription={combinedTranscription}
            onArticleComplete={handleArticleGenerated}
          />
        )
      
      case 'draft':
        if (!project || !article) return null
        return (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">記事完成</h2>
            <div className="text-center">
              <div className="text-green-600 text-lg mb-4">
                ✓ 記事が正常に生成されました！
              </div>
              <p className="text-gray-600 mb-6">
                「Complete」ステップで記事をご確認ください。
              </p>
              <button
                onClick={() => setCurrentStep('complete')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
              >
                記事を確認する
              </button>
            </div>
          </div>
        )
      
      case 'complete':
        if (!article) return null
        return (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-green-600 mb-4">
                インタビュー記事完成！
              </h2>
              <p className="text-gray-600 mb-6">
                インタビューが正常に処理され、ブログ向けの構造化された記事が作成されました。<br/>
                記事タイトル・リード文・H2見出し構成・まとめを含む完全な記事です。
              </p>
            </div>
            
            {project && (
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-2">プロジェクトサマリー</h3>
                <p><strong>タイトル:</strong> {project.title}</p>
                <p><strong>テーマ:</strong> {project.theme}</p>
                <p><strong>インタビュイー:</strong> {project.interviewee}</p>
              </div>
            )}

            {/* Article Display */}
            <div className="border rounded-lg mb-6">
              <div className="border-b p-4 bg-gray-50">
                <h4 className="text-xl font-bold">{article.title}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  生成日: {new Date(article.createdAt).toLocaleDateString('ja-JP')} • 
                  フォーマット: {article.format}
                </p>
              </div>

              <div className="p-6">
                <div className="prose max-w-none">
                  <div 
                    className="whitespace-pre-wrap text-sm bg-white p-4 rounded border leading-relaxed max-h-96 overflow-y-auto"
                    style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  >
                    {article.content}
                  </div>
                </div>
              </div>

              {/* Download Actions */}
              <div className="border-t p-4 bg-gray-50">
                <h5 className="text-sm font-medium text-gray-700 mb-3">ダウンロード:</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <a
                    href={`/api/download/${article.id}?format=txt`}
                    download
                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm text-center"
                  >
                    📄 TXT
                  </a>
                  <a
                    href={`/api/download/${article.id}?format=markdown`}
                    download
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm text-center"
                  >
                    📝 Markdown
                  </a>
                  <a
                    href={`/api/download/${article.id}?format=docx`}
                    download
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm text-center"
                  >
                    📃 Word
                  </a>
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

            <div className="text-center space-y-4">
              <div className="text-sm text-gray-600">
                ✓ AI質問生成完了<br/>
                ✓ 対話形式録音・文字起こし完了<br/>
                ✓ ブログ向け構造化記事作成完了<br/>
                ✓ 記事タイトル・リード文・H2見出し・まとめ構成<br/>
                ✓ TXT・Markdown・Word形式でダウンロード可能
              </div>
              
              <button
                onClick={resetWorkflow}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
              >
                新しいインタビューを開始
              </button>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 py-8 text-center">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              AI Interviewer SaaS
            </h1>
            <p className="text-lg text-gray-600">
              Transform interviews into articles with AI
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        {renderSteps()}

        {/* Current Step Content */}
        <div className="max-w-6xl mx-auto px-4 pb-8">
          {renderCurrentStep()}
        </div>
      </div>
    </div>
  )
}