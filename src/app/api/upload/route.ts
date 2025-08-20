import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // In production, you would upload to Supabase Storage or similar
    // For now, save to local uploads directory
    const filename = `${Date.now()}_${file.name}`
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    
    // Create uploads directory if it doesn't exist
    try {
      await writeFile(join(uploadsDir, filename), buffer)
    } catch (error) {
      // Directory might not exist, try to create it
      const { mkdir } = await import('fs/promises')
      await mkdir(uploadsDir, { recursive: true })
      await writeFile(join(uploadsDir, filename), buffer)
    }

    const fileUrl = `/uploads/${filename}`

    return NextResponse.json({ 
      success: true, 
      url: fileUrl,
      filename: filename
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}