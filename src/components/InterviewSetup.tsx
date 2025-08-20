'use client'

import { useState } from 'react'
import { CreateProjectData, Project, Question, ArticleType } from '@/types'

interface InterviewSetupProps {
  onProjectCreated: (project: Project) => void
  onQuestionsGenerated: (questions: Question[]) => void
  onArticleTypeSelected?: (articleType: ArticleType) => void
}

export default function InterviewSetup({ onProjectCreated, onQuestionsGenerated, onArticleTypeSelected }: InterviewSetupProps) {
  const [formData, setFormData] = useState<CreateProjectData>({
    title: '',
    description: '',
    theme: '',
    interviewee: '',
  })
  const [articleType, setArticleType] = useState<ArticleType>('BLOG_POST')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Function to check if server is reachable
  const checkServerConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/projects', { method: 'GET' })
      return response.ok
    } catch (error) {
      console.error('Server connection check failed:', error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submission started', formData)
    setIsLoading(true)
    setError('')

    try {
      // Validate form data
      if (!formData.title.trim() || !formData.theme.trim() || !formData.interviewee.trim()) {
        throw new Error('すべての必須フィールドを入力してください')
      }

      // Check server connection first
      console.log('Checking server connection...')
      const serverReachable = await checkServerConnection()
      if (!serverReachable) {
        throw new Error('サーバーに接続できません。開発サーバーが起動しているか確認してください。')
      }

      console.log('Creating project...')
      // Create project with retry logic
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      }).catch((fetchError) => {
        console.error('Network error when creating project:', fetchError)
        throw new Error('ネットワークエラー: サーバーに接続できません。ページを再読み込みして再度お試しください。')
      })

      console.log('Project response status:', projectResponse.status)

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json().catch(() => ({}))
        console.error('Project creation failed:', errorData)
        throw new Error(errorData.error || `プロジェクトの作成に失敗しました (HTTP ${projectResponse.status})`)
      }

      const project: Project = await projectResponse.json()
      console.log('Project created successfully:', project.id)
      onProjectCreated(project)

      console.log('Generating questions...')
      // Generate questions with retry logic
      const questionsResponse = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          theme: formData.theme,
          interviewee: formData.interviewee,
        }),
      }).catch((fetchError) => {
        console.error('Network error when generating questions:', fetchError)
        throw new Error('ネットワークエラー: 質問生成サービスに接続できません。ページを再読み込みして再度お試しください。')
      })

      console.log('Questions response status:', questionsResponse.status)

      if (!questionsResponse.ok) {
        const errorData = await questionsResponse.json().catch(() => ({}))
        console.error('Questions generation failed:', errorData)
        throw new Error(errorData.error || `質問の生成に失敗しました (HTTP ${questionsResponse.status})`)
      }

      const questions: Question[] = await questionsResponse.json()
      console.log('Questions generated successfully:', questions.length)
      onQuestionsGenerated(questions)
      
      // Notify parent component about selected article type
      if (onArticleTypeSelected) {
        onArticleTypeSelected(articleType)
      }

    } catch (err) {
      console.error('Form submission error:', err)
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Setup Your Interview</h2>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Interview Title
              </label>
              <input
                type="text"
                id="title"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Tech Leadership Interview"
              />
            </div>

            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-gray-700 mb-2">
                Interview Theme
              </label>
              <input
                type="text"
                id="theme"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                placeholder="e.g., Technology, Business, Lifestyle"
              />
            </div>

            <div>
              <label htmlFor="interviewee" className="block text-sm font-medium text-gray-700 mb-2">
                Interviewee Information
              </label>
              <input
                type="text"
                id="interviewee"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.interviewee}
                onChange={(e) => setFormData({ ...formData, interviewee: e.target.value })}
                placeholder="e.g., John Doe, CEO of TechCorp"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the interview purpose..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Article Type
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`relative cursor-pointer rounded-lg border p-4 transition-all ${
                    articleType === 'BLOG_POST'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => setArticleType('BLOG_POST')}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="articleType"
                      value="BLOG_POST"
                      checked={articleType === 'BLOG_POST'}
                      onChange={(e) => setArticleType(e.target.value as ArticleType)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-900">
                      Blog Post
                    </label>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    • 導入・背景・主要トピック・まとめ
                    • 主張と根拠を明確に
                    • FAQ・CTA付き
                  </div>
                </div>

                <div
                  className={`relative cursor-pointer rounded-lg border p-4 transition-all ${
                    articleType === 'HOW_TO_GUIDE'
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => setArticleType('HOW_TO_GUIDE')}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="articleType"
                      value="HOW_TO_GUIDE"
                      checked={articleType === 'HOW_TO_GUIDE'}
                      onChange={(e) => setArticleType(e.target.value as ArticleType)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label className="ml-3 block text-sm font-medium text-gray-900">
                      How-To Guide
                    </label>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    • 前提条件・材料・所要時間
                    • 番号付き手順・難易度
                    • トラブルシューティング付き
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-red-600 text-sm">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
            >
              {isLoading ? 'Creating Project & Generating Questions...' : 'Create Project & Generate Questions'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}