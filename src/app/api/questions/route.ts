import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateQuestions } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    console.log('POST /api/questions called')
    const { projectId, theme, interviewee } = await req.json()
    console.log('Received data:', { projectId, theme, interviewee })
    
    if (!projectId || !theme || !interviewee) {
      console.error('Missing required fields:', { projectId, theme, interviewee })
      return NextResponse.json(
        { error: 'プロジェクトID、テーマ、インタビュイー情報が必要です' },
        { status: 400 }
      )
    }

    console.log('Generating questions with OpenAI...')
    const questions = await generateQuestions(theme, interviewee)
    console.log('Generated questions:', questions)
    
    if (!questions || questions.length === 0) {
      console.error('No questions generated')
      return NextResponse.json(
        { error: '質問の生成に失敗しました。OpenAI APIの応答が空です。' },
        { status: 500 }
      )
    }
    
    console.log('Saving questions to database...')
    const createdQuestions = await Promise.all(
      questions.map((content, index) =>
        prisma.question.create({
          data: {
            content: content.trim(),
            order: index + 1,
            projectId,
          },
        })
      )
    )

    console.log('Questions created successfully:', createdQuestions.length)
    return NextResponse.json(createdQuestions)
  } catch (error) {
    console.error('Error generating questions:', error)
    return NextResponse.json(
      { error: `質問の生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    )
  }
}