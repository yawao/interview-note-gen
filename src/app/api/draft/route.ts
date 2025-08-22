import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateArticleDraft, generateOutlineAndMeta, generateArticleContent } from '@/lib/openai'
import { enforcePhase0, extractTitleFromMarkdown, buildTitleFallback, buildMetaDescription } from '@/lib/phase0'
import { ArticleType } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { projectId, articleType, language }: { 
      projectId: string; 
      articleType?: ArticleType; 
      language?: 'ja' | 'en' 
    } = await req.json()
    
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
    
    console.log('Generating article for project:', projectId)
    console.log('Theme:', project.theme)
    console.log('Interviewee:', project.interviewee)
    console.log('Article Type:', articleType || 'BLOG_POST')

    const selectedArticleType: ArticleType = articleType || 'BLOG_POST'
    const selectedLanguage: 'ja' | 'en' = language || 'ja'

    // Generate outline and meta based on article type
    const { outline, meta } = await generateOutlineAndMeta(
      selectedArticleType,
      project.theme,
      project.interviewee,
      transcription,
      selectedLanguage
    )

    // Generate article content based on outline and meta
    const articleContent = await generateArticleContent(
      selectedArticleType,
      project.theme,
      outline,
      meta,
      selectedLanguage
    )
    
    if (!articleContent || articleContent.trim() === '') {
      return NextResponse.json(
        { error: '記事の生成に失敗しました。内容が空です。' },
        { status: 500 }
      )
    }

    // Apply Phase 0 enforcement to ensure content quality
    console.log('Applying Phase 0 enforcement...')
    const enforcedContent = await enforcePhase0({
      md: articleContent.trim(),
      articleType: selectedArticleType,
      theme: project.theme
    })

    // Extract title from markdown or use fallback
    const extractedTitle = extractTitleFromMarkdown(enforcedContent)
    const finalTitle = extractedTitle || buildTitleFallback(project.theme, project.interviewee)

    // Generate meta description
    const metaDescription = buildMetaDescription({
      primaryKeyword: project.theme,
      theme: project.theme,
      benefit: `${project.interviewee}氏の実体験から学ぶ`,
      action: '読む'
    })
    
    const savedArticle = await prisma.article.create({
      data: {
        title: finalTitle,
        content: enforcedContent,
        format: 'markdown',
        articleType: selectedArticleType,
        language: selectedLanguage,
        status: 'DRAFT',
        outline: JSON.stringify(outline),
        meta: JSON.stringify(meta),
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