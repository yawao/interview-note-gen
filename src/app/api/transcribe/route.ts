import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { transcribeAudio } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const projectId = formData.get('projectId') as string
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'Missing audio file' },
        { status: 400 }
      )
    }

    const transcription = await transcribeAudio(audioFile)
    
    // If projectId is provided, save to database
    if (projectId) {
      const savedTranscription = await prisma.transcription.create({
        data: {
          audioUrl: `temp/${audioFile.name}`, // Temporary URL, would use real storage in production
          text: transcription,
          projectId,
        },
      })
      return NextResponse.json(savedTranscription)
    } else {
      // For follow-up questions, just return the transcription text
      return NextResponse.json({ transcription })
    }
  } catch (error) {
    console.error('Error transcribing audio:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}