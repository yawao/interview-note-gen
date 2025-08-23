import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractStructuredInterview } from '@/lib/openai'
import { InterviewPayload, Question, Answer, InterviewBlock } from '@/types/interview'
import { systemPrompt, userPrompt, interviewArticleSchema, validateResponseStructure } from '@/lib/prompt/interviewArticle'
import { clampAndNormalizeBlocks, validateQuestionCount, validateUnansweredBlocks } from '@/lib/interview-validation'
import { stripHeadingsAndBullets } from '@/lib/text/sanitize'
import { openai } from '@/lib/openai'

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
    
    console.log(`🚀 新方式での構造化インタビュー処理開始: 質問数=${questions.length}`)
    
    // 1) 既存の構造化抽出でevidenceベースの回答を取得
    const structuredResult = await extractStructuredInterview(transcription, questions, {
      strict_no_autofill: true,
      exact_length_output: true,
      unanswered_token: '未回答'
    })
    
    // 2) InterviewPayloadを組み立て
    const payload: InterviewPayload = await buildInterviewPayload(project, structuredResult)
    
    // 3) JSON入出力による記事化LLM呼び出し
    const articleBlocks = await generateArticleWithJsonIO(payload)
    
    // 4) 最終バリデーション（N-in / N-out 保証）
    const finalBlocks = clampAndNormalizeBlocks(payload, articleBlocks)
    
    // 5) バリデーション結果の確認
    const countValidation = validateQuestionCount(questions, finalBlocks)
    const unansweredValidation = validateUnansweredBlocks(payload, finalBlocks)
    
    if (!countValidation.isValid) {
      console.error('❌ 質問数バリデーション失敗:', countValidation.message)
    }
    if (!unansweredValidation.isValid) {
      console.error('❌ 未回答バリデーション失敗:', unansweredValidation.violations)
    }
    
    // 6) レガシー形式のコンテンツ生成（既存UIの互換性のため）
    const legacyContent = finalBlocks.map((block) => {
      const hasEvidence = payload.answers.find(a => {
        const question = payload.questions.find(q => q.order === block.order)
        return question && a.questionId === question.id && a.hasEvidence
      })
      
      const status = hasEvidence ? '✅ 回答あり' : '❌ 未回答'
      return `## Q${block.order}: ${block.question}\n**回答**: ${block.body}\n**ステータス**: ${status}`
    }).join('\n\n')
    
    const savedSummary = await prisma.summary.create({
      data: {
        content: legacyContent,
        projectId,
      },
    })

    // 拡張レスポンス（新しい構造化データ含む）
    return NextResponse.json({
      ...savedSummary,
      
      // 新しいJSON形式のレスポンス
      blocks: finalBlocks,
      
      // 従来との互換性
      structured: structuredResult.summary,
      metadata: {
        ...structuredResult.metadata,
        questionCountValid: countValidation.isValid,
        unansweredValid: unansweredValidation.isValid,
        processingMethod: 'json-io-v2'
      },
      stats: {
        totalQuestions: questions.length,
        totalBlocks: finalBlocks.length,
        answeredCount: finalBlocks.filter(block => block.body !== '未回答').length,
        unansweredCount: finalBlocks.filter(block => block.body === '未回答').length,
        validationPassed: countValidation.isValid && unansweredValidation.isValid
      }
    })
  } catch (error) {
    console.error('Error summarizing interview:', error)
    return NextResponse.json(
      { error: 'Failed to summarize interview' },
      { status: 500 }
    )
  }
}

/**
 * DB/ストアから InterviewPayload を組み立て
 */
async function buildInterviewPayload(project: any, structuredResult: any): Promise<InterviewPayload> {
  console.log('🔧 InterviewPayload組み立て開始')
  
  // Questionsを構築
  const questions: Question[] = project.questions.map((q: any, index: number) => ({
    id: q.id.toString(),
    order: index + 1,
    text: q.content
  }))
  
  // Answersを構築（structured resultから）
  const answers: Answer[] = structuredResult.summary.items.map((item: any, index: number) => {
    const questionId = questions[index]?.id || `q_${index + 1}`
    
    return {
      questionId,
      text: item.answer || '',
      hasEvidence: item.status === 'answered' && item.evidence.length > 0
    }
  })
  
  // Contextを構築（サニタイズ済みのトランスクリプト）
  const rawTranscript = project.transcriptions[0]?.text || ''
  const sanitizedContext = stripHeadingsAndBullets(rawTranscript)
  
  const payload: InterviewPayload = {
    questions,
    answers,
    context: sanitizedContext
  }
  
  console.log(`✅ Payload構築完了: ${questions.length}質問, ${answers.length}回答`)
  console.log(`- Evidence有り: ${answers.filter(a => a.hasEvidence).length}件`)
  console.log(`- Evidence無し: ${answers.filter(a => !a.hasEvidence).length}件`)
  
  return payload
}

/**
 * JSON入出力によるLLM記事化呼び出し
 */
async function generateArticleWithJsonIO(payload: InterviewPayload): Promise<InterviewBlock[]> {
  console.log('🤖 JSON入出力LLM呼び出し開始')
  
  try {
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { 
          role: "system", 
          content: systemPrompt 
        },
        { 
          role: "user", 
          content: `${userPrompt}\n\n${JSON.stringify(payload, null, 2)}`
        }
      ],
      max_output_tokens: 8000
    })

    const rawResponse = completion.output_text
    
    console.log('🔍 LLM生レスポンス構造チェック')
    
    let parsedResponse
    if (typeof rawResponse === 'string') {
      parsedResponse = JSON.parse(rawResponse)
    } else {
      parsedResponse = rawResponse
    }
    
    // 構造バリデーション
    const structureValidation = validateResponseStructure(parsedResponse)
    if (!structureValidation.isValid) {
      console.error('❌ レスポンス構造エラー:', structureValidation.errors)
      throw new Error(`Invalid response structure: ${structureValidation.errors.join(', ')}`)
    }
    
    const blocks: InterviewBlock[] = parsedResponse.blocks
    console.log(`✅ LLM記事化完了: ${blocks.length}ブロック生成`)
    
    // 重要：質問数チェック
    if (blocks.length !== payload.questions.length) {
      console.warn(`⚠️ 質問数不一致検出: 期待${payload.questions.length}, 実際${blocks.length}`)
    }
    
    return blocks
    
  } catch (error) {
    console.error('❌ LLM記事化エラー:', error)
    
    // フォールバック：基本的な構造を返す
    const fallbackBlocks: InterviewBlock[] = payload.questions.map((q, index) => {
      const answer = payload.answers.find(a => a.questionId === q.id)
      return {
        order: q.order,
        question: q.text,
        body: answer?.hasEvidence ? (answer.text || '未回答') : '未回答'
      }
    })
    
    console.log(`🔧 フォールバック使用: ${fallbackBlocks.length}ブロック`)
    return fallbackBlocks
  }
}