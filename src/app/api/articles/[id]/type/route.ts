import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ArticleType } from '@/types'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { articleType }: { articleType: ArticleType } = await req.json()
    const { id } = await params
    
    if (!articleType || !['BLOG_POST', 'HOW_TO_GUIDE'].includes(articleType)) {
      return NextResponse.json(
        { error: '無効な記事タイプです' },
        { status: 400 }
      )
    }

    const existingArticle = await prisma.article.findUnique({
      where: { id },
    })

    if (!existingArticle) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      )
    }

    const updatedArticle = await prisma.article.update({
      where: { id },
      data: {
        articleType,
        // Reset outline and meta when changing type
        outline: null,
        meta: null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json(updatedArticle)
  } catch (error) {
    console.error('Error updating article type:', error)
    return NextResponse.json(
      { error: '記事タイプの更新に失敗しました' },
      { status: 500 }
    )
  }
}