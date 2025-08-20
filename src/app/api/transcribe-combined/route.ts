import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { projectId, text } = await req.json()
    
    if (!projectId || !text) {
      return NextResponse.json(
        { error: 'Missing project ID or text' },
        { status: 400 }
      )
    }

    const savedTranscription = await prisma.transcription.create({
      data: {
        audioUrl: 'combined-interview',
        text: text,
        projectId: projectId,
      },
    })

    return NextResponse.json(savedTranscription)
  } catch (error) {
    console.error('Error saving combined transcription:', error)
    return NextResponse.json(
      { error: 'Failed to save combined transcription' },
      { status: 500 }
    )
  }
}