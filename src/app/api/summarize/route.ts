import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractStructuredInterview } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing project ID' },
        { status: 400 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        questions: { orderBy: { order: 'asc' } },
        transcriptions: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (project.transcriptions.length === 0) {
      return NextResponse.json(
        { error: 'No transcriptions found for this project' },
        { status: 400 }
      )
    }

    const questions = project.questions.map(q => q.content)
    const transcription = project.transcriptions[0].text // Use first transcription
    
    console.log(`構造化インタビュー抽出開始: 質問数=${questions.length}, 文字起こし長=${transcription.length}`)
    
    // 新しい構造化抽出を実行
    const result = await extractStructuredInterview(transcription, questions, {
      strict_no_autofill: true,
      exact_length_output: true,
      unanswered_token: '未回答'
    })
    
    // レガシー形式のコンテンツも生成（既存UIの互換性のため）
    const legacyContent = result.summary.items.map((item, index) => {
      const status = item.status === 'answered' ? '✅ 回答あり' : '❌ 未回答'
      const answer = item.answer || '未回答'
      const evidence = item.evidence.length > 0 ? 
        `\n根拠: ${item.evidence.map(e => `"${e}"`).join(', ')}` : ''
      
      return `## Q${index + 1}: ${item.question}\n**回答**: ${answer}\n**ステータス**: ${status}${evidence}`
    }).join('\n\n')
    
    const savedSummary = await prisma.summary.create({
      data: {
        content: legacyContent,
        projectId,
      },
    })

    // 拡張レスポンス（新しい構造化データも含む）
    return NextResponse.json({
      ...savedSummary,
      structured: result.summary,
      metadata: result.metadata,
      stats: {
        totalQuestions: questions.length,
        answeredCount: result.summary.items.filter(item => item.status === 'answered').length,
        unansweredCount: result.summary.items.filter(item => item.status === 'unanswered').length,
        evidenceCount: result.summary.items.reduce((acc, item) => acc + item.evidence.length, 0)
      }
    })
  } catch (error) {
    console.error('Error summarizing interview:', error)
    return NextResponse.json(
      { error: 'Failed to summarize interview' },
      { status: 500 }
    )
  }
}