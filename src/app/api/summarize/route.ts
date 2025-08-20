import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { summarizeInterview } from '@/lib/openai'

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
    
    const summary = await summarizeInterview(transcription, questions)
    
    const savedSummary = await prisma.summary.create({
      data: {
        content: summary,
        projectId,
      },
    })

    return NextResponse.json(savedSummary)
  } catch (error) {
    console.error('Error summarizing interview:', error)
    return NextResponse.json(
      { error: 'Failed to summarize interview' },
      { status: 500 }
    )
  }
}