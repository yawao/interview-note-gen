import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateArticleDraft, generateOutlineAndMeta, generateArticleContent, generateStructuredArticle } from '@/lib/openai'
import { renderMarkdownFromStructured, finalGuard } from '@/lib/render-markdown'
import { enforcePhase0, extractTitleFromMarkdown, buildTitleFallback, buildMetaDescription } from '@/lib/phase0'
import { rewriteStructure } from '@/lib/rewrite'
import { ArticleType } from '@/types'
import { ArticleSection } from '@/types/article'

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

    // Writesonic-style: Generate JSON structure first
    console.log('Generating structured article JSON...')
    const structuredArticle = await generateStructuredArticle(
      selectedArticleType,
      project.theme,
      project.interviewee,
      transcription,
      selectedLanguage
    )

    // Server-side: Convert JSON to Markdown deterministically
    console.log('Converting JSON to Markdown...')
    let articleContent = renderMarkdownFromStructured(structuredArticle)
    
    // Apply final mechanical corrections
    console.log('Applying final guard corrections...')
    articleContent = finalGuard(articleContent)
    
    if (!articleContent || articleContent.trim() === '') {
      return NextResponse.json(
        { error: '記事の生成に失敗しました。内容が空です。' },
        { status: 500 }
      )
    }

    // Apply structure rewrite to fix composition issues
    console.log('Applying structure rewrite...')
    let md = await rewriteStructure({ 
      md: articleContent.trim(), 
      articleType: selectedArticleType 
    })
    
    // Apply Phase 0 enforcement to ensure content quality
    console.log('Applying Phase 0 enforcement...')
    const enforcedContent = await enforcePhase0({
      md,
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
        outline: JSON.stringify({ sections: structuredArticle.sections.map((s: ArticleSection, i: number) => ({ id: `section-${i}`, heading: s.h2, order: i + 1 })) }),
        meta: JSON.stringify({ structuredData: structuredArticle }),
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