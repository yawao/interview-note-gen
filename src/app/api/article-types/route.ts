import { NextResponse } from 'next/server'
import { ArticleType } from '@/types'

export async function GET() {
  try {
    const articleTypes: ArticleType[] = ['BLOG_POST', 'HOW_TO_GUIDE']
    
    return NextResponse.json(articleTypes)
  } catch (error) {
    console.error('Error getting article types:', error)
    return NextResponse.json(
      { error: '記事タイプの取得に失敗しました' },
      { status: 500 }
    )
  }
}