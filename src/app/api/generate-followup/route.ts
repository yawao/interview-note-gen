import { NextRequest, NextResponse } from 'next/server'
import { generateFollowUpQuestion } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const { originalQuestion, answer } = await request.json()

    if (!originalQuestion || !answer) {
      return NextResponse.json(
        { error: '元の質問と回答が必要です' },
        { status: 400 }
      )
    }

    const followUpQuestion = await generateFollowUpQuestion(originalQuestion, answer)

    return NextResponse.json({ followUpQuestion })
  } catch (error) {
    console.error('Follow-up question generation error:', error)
    return NextResponse.json(
      { error: '深掘り質問の生成に失敗しました' },
      { status: 500 }
    )
  }
}