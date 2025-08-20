import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CreateProjectData } from '@/types'

export async function POST(req: NextRequest) {
  try {
    console.log('POST /api/projects called')
    const data: CreateProjectData = await req.json()
    console.log('Received data:', data)
    
    // Validate required fields
    if (!data.title || !data.theme || !data.interviewee) {
      console.error('Missing required fields:', data)
      return NextResponse.json(
        { error: 'タイトル、テーマ、インタビュイー情報は必須です' },
        { status: 400 }
      )
    }
    
    const project = await prisma.project.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        theme: data.theme.trim(),
        interviewee: data.interviewee.trim(),
      },
      include: {
        questions: true,
        transcriptions: true,
        summaries: true,
        articles: true,
      },
    })

    console.log('Project created successfully:', project.id)
    return NextResponse.json(project)
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: `プロジェクトの作成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        questions: true,
        transcriptions: true,
        summaries: true,
        articles: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}