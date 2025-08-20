import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
// import pdf from 'html-pdf-node' // Temporarily disabled due to compatibility issues

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'markdown'
    
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        project: true,
      },
    })

    if (!article) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      )
    }

    let content = article.content
    let contentType = 'text/markdown'
    let filename = `${article.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}`

    switch (format) {
      case 'txt':
        // Convert markdown to plain text (basic conversion)
        content = content
          .replace(/#{1,6}\s/g, '') // Remove headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        contentType = 'text/plain'
        filename += '.txt'
        break

      case 'markdown':
        contentType = 'text/markdown'
        filename += '.md'
        break

      case 'docx':
        try {
          const doc = await createWordDocument(article.title, article.content)
          const buffer = await Packer.toBuffer(doc)
          
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'Content-Disposition': `attachment; filename="${filename}.docx"`,
            },
          })
        } catch (error) {
          console.error('Error creating Word document:', error)
          return NextResponse.json(
            { error: 'Word文書の作成に失敗しました' },
            { status: 500 }
          )
        }

      case 'pdf':
        // PDF generation temporarily disabled due to library compatibility issues
        return NextResponse.json(
          { error: 'PDF機能は現在メンテナンス中です。Markdown、TXT、またはWordをご利用ください。' },
          { status: 503 }
        )

      default:
        filename += '.md'
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error downloading article:', error)
    return NextResponse.json(
      { error: `記事のダウンロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` },
      { status: 500 }
    )
  }
}

async function createWordDocument(title: string, content: string): Promise<Document> {
  const lines = content.split('\n')
  const children: Paragraph[] = []

  // Add title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
    })
  )

  lines.forEach((line) => {
    if (line.trim() === '') {
      children.push(new Paragraph({ text: '' }))
    } else if (line.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: line.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
        })
      )
    } else if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: line.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
        })
      )
    } else if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: line.replace('### ', ''),
          heading: HeadingLevel.HEADING_3,
        })
      )
    } else {
      // Handle bold and italic text
      const textRuns: TextRun[] = []
      const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g)
      
      parts.forEach((part) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          textRuns.push(new TextRun({ text: part.slice(2, -2), bold: true }))
        } else if (part.startsWith('*') && part.endsWith('*')) {
          textRuns.push(new TextRun({ text: part.slice(1, -1), italics: true }))
        } else if (part) {
          textRuns.push(new TextRun({ text: part }))
        }
      })

      children.push(new Paragraph({ children: textRuns }))
    }
  })

  return new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  })
}

// markdownToHtml function removed due to PDF library compatibility issues