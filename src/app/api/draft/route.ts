import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateArticleDraft } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json()
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'プロジェクトIDが不足しています' },
        { status: 400 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        summaries: { orderBy: { createdAt: 'desc' } },
        transcriptions: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    if (project.transcriptions.length === 0) {
      return NextResponse.json(
        { error: 'このプロジェクトの文字起こしがありません' },
        { status: 400 }
      )
    }

    // Get the latest transcription (combined interview that includes follow-up questions)
    const latestTranscription = project.transcriptions.find(t => t.audioUrl === 'combined-interview') || project.transcriptions[0]
    const transcription = latestTranscription.text
    
    // Use summary if available, otherwise use transcription directly
    const summary = project.summaries.length > 0 ? project.summaries[0].content : transcription
    
    console.log('Generating article for project:', projectId)
    console.log('Theme:', project.theme)
    console.log('Interviewee:', project.interviewee)
    
    const articleContent = await generateArticleDraft(
      project.theme,
      project.interviewee,
      summary,
      transcription
    )
    
    if (!articleContent || articleContent.trim() === '') {
      return NextResponse.json(
        { error: '記事の生成に失敗しました。内容が空です。' },
        { status: 500 }
      )
    }
    
    const savedArticle = await prisma.article.create({
      data: {
        title: `${project.interviewee}氏インタビュー：${project.theme}について`,
        content: articleContent.trim(),
        format: 'text',
        projectId,
      },
    })

    console.log('Article created successfully:', savedArticle.id)
    return NextResponse.json(savedArticle)
  } catch (error) {
    console.error('Error generating article draft:', error)
    return NextResponse.json(
      { error: `記事の生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    )
  }
}