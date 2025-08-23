import OpenAI from 'openai'
import { ArticleType, BlogMeta, HowToMeta, OutlineSection, BLOG_OUTLINE_SKELETON, HOWTO_OUTLINE_SKELETON, StructuredInterviewSummary, InterviewExtractionOptions } from '@/types'
import { normalizeInterviewSummary } from './interview-normalization'
import { validateInterviewSchema, generateRepairPrompt, extractJsonFromOutput, logValidationResult } from './interview-schema'
import { validateInterviewSummary, generateDebugInfo } from '@/lib/interview-validation'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const generateQuestions = async (theme: string, interviewee: string) => {
  try {
    console.log('Calling OpenAI API for question generation...')
    console.log('Theme:', theme, 'Interviewee:', interviewee)
    
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "あなたは専門的なインタビュアーです。テーマとインタビュイーの情報に基づいて、厳密に5-7個の深掘りできる質問を日本語で生成してください。質問のみを1行ずつ、番号や記号なしで返してください。追加の説明や解説は一切不要です。必ず5個以上7個以下の質問のみを返してください。"
        },
        {
          role: "user",
          content: `テーマ: ${theme}\nインタビュイー: ${interviewee}\n\n上記の情報をもとに、日本語でインタビュー質問を作成してください。`
        }
      ],
      max_output_tokens: 12000,
    })

    console.log('OpenAI response received')
    const content = completion.output_text || ''
    console.log('Raw content:', content)
    
    if (!content) {
      throw new Error('OpenAIから応答がありませんでした')
    }

    const questions = content.split('\n').filter(q => q.trim())
    console.log('Parsed questions:', questions)
    
    if (questions.length === 0) {
      throw new Error('質問が生成されませんでした')
    }
    
    // 5-7個の質問に制限
    const limitedQuestions = questions.slice(0, 7)
    if (limitedQuestions.length < 5) {
      throw new Error('質問が5個未満です。再生成してください。')
    }
    
    return limitedQuestions
  } catch (error) {
    console.error('OpenAI API error in generateQuestions:', error)
    throw new Error(`質問生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}

export const transcribeAudio = async (audioFile: File) => {
  const maxRetries = 3
  let retryCount = 0
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Starting transcription for file (attempt ${retryCount + 1}/${maxRetries}):`, audioFile.name, 'Size:', audioFile.size, 'Type:', audioFile.type)
      
      // Validate audio file
      if (!audioFile || audioFile.size === 0) {
        throw new Error('音声ファイルが空です')
      }
      
      if (audioFile.size > 25 * 1024 * 1024) { // 25MB limit for Whisper
        throw new Error('音声ファイルが大きすぎます（25MB以下にしてください）')
      }
      
      // Add timeout for long transcriptions (5 minutes)
      const transcriptionPromise = openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "ja", // Japanese, adjust as needed
        response_format: "text",
        // Optional: Add prompt for better accuracy with Japanese content
        prompt: "これは日本語のインタビューです。専門用語や固有名詞を正確に転写してください。",
      })
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('転写処理がタイムアウトしました（5分）')), 5 * 60 * 1000)
      })
      
      const transcription = await Promise.race([transcriptionPromise, timeoutPromise])

      console.log('Transcription completed successfully')
      console.log('Transcription length:', typeof transcription === 'string' ? transcription.length : 'N/A', 'characters')
      return transcription
    } catch (error) {
      console.error(`Transcription error (attempt ${retryCount + 1}):`, error)
      
      // Check if it's a connection error that we should retry
      const isConnectionError = error instanceof Error && 
        (error.message.includes('Connection error') || 
         error.message.includes('ECONNRESET') ||
         error.message.includes('fetch failed') ||
         error.message.includes('network'))
      
      if (isConnectionError && retryCount < maxRetries - 1) {
        retryCount++
        const waitTime = Math.pow(2, retryCount) * 1000 // Exponential backoff
        console.log(`Retrying in ${waitTime}ms...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
      
      throw new Error(`音声の文字起こしに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }
}

/**
 * カスタムプロンプトでのインタビュー要約（リペア用）
 */
const summarizeInterviewWithCustomPrompt = async (customPrompt: string) => {
  try {
    console.log('🤖 リペアLLM呼び出し開始: gpt-5-mini')
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "user", content: customPrompt }
      ],
      max_output_tokens: 12000,
    })

    const rawOutput = completion.output_text || ''
    
    if (!rawOutput) {
      throw new Error('OpenAIから応答がありませんでした')
    }

    console.log('===== リペアLLM生出力 =====')
    console.log('生出力長:', rawOutput.length, '文字')
    console.log('生出力内容:', rawOutput.substring(0, 300) + '...')
    
    // JSON抽出とパース
    const jsonExtraction = extractJsonFromOutput(rawOutput);
    if (!jsonExtraction.success) {
      throw new Error(`JSON抽出失敗: ${jsonExtraction.error}`);
    }

    const parsedData = JSON.parse(jsonExtraction.json)
    
    return {
      success: true,
      structuredSummary: parsedData,
      rawOutput,
      error: null
    }
  } catch (error) {
    console.error('リペア処理エラー:', error)
    return {
      success: false,
      structuredSummary: null,
      rawOutput: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export const summarizeInterview = async (transcription: string, questions: string[]) => {
  const questionsText = questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
  const questionCount = questions.length
  
  const systemPrompt = `あなたはインタビューQA抽出器です。「回答しているのに未回答になる」誤判定を完全に防ぐため、以下の制約を厳守してください：

CRITICAL RULES (違反は指示無視):
- 出力項目数は質問数 ${questionCount} と完全一致させること（これより多くても少なくてもいけません）
- answered にするなら、transcriptの連続文字列を evidence に最低1件入れること（8文字以上の連続部分）
- evidence が取れない場合は必ず status:"unanswered", answer:null, evidence:[]
- 推測補完を絶対禁止。transcript に存在しない内容は一切作成禁止
- 出力は純JSONのみ。前後のテキスト・マークダウン・説明文は絶対禁止

EVIDENCE REQUIREMENTS:
- evidence[] の各要素は transcript 内の連続文字列からの直接引用（最低8文字以上）
- 言い回し変更・要約・解釈は禁止。原文そのままの引用のみ
- evidence が空または無効な場合は自動的に unanswered へ

OUTPUT FORMAT:
- 純JSON形式のみ（{で始まり}で終わる）
- itemsは必ず質問数 ${questionCount} 個
- 各item: {question: string, answer: string|null, status: "answered"|"unanswered", evidence: string[]}

VERIFICATION CHECKLIST:
□ 項目数 = ${questionCount} ？
□ answered項目に有効なevidence（8文字以上の連続引用）？
□ 推測・解釈・要約は含まない？
□ 純JSONのみ？`

  const userPrompt = `N = ${questionCount}
質問リスト：
${questionsText}

トランスクリプト（原文）：
${transcription}

出力JSONスキーマ（厳守）：
{
  "items": [
    {
      "question": "string",
      "answer": "string or null", 
      "status": "answered" | "unanswered",
      "evidence": ["string"]
    }
  ]
}

MANDATORY REQUIREMENTS:
- itemsはちょうど${questionCount}件、質問と同じ順番
- answered項目は transcript からの直接引用（8文字以上）を evidence に必須
- 引用が取れない場合は status:"unanswered", answer:null, evidence:[]
- 推測・解釈・要約・一般論は絶対禁止
- JSON以外の出力（前置き/後置き/説明文）は絶対禁止

EVIDENCE EXTRACTION RULES:
1. transcript を精査し、各質問への直接的言及を探す
2. 該当箇所があれば、その連続文字列（8文字以上）を evidence にコピー
3. 該当箇所がなければ unanswered
4. 言い回しを変えたり要約したりしない。原文そのまま引用

FINAL CHECK: 出力前に必ず確認
□ 項目数 = ${questionCount}
□ answered項目にはすべて有効なevidence
□ 純JSONのみ（説明文なし）`

  try {
    console.log('🤖 LLM呼び出し開始: gpt-5-mini')
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_output_tokens: 12000,
    })

    const rawOutput = completion.output_text || ''
    
    if (!rawOutput) {
      throw new Error('OpenAIから応答がありませんでした')
    }

    // デバッグ用ログ追加
    console.log('===== LLM生出力デバッグ =====')
    console.log('期待質問数:', questionCount)
    console.log('生出力長:', rawOutput.length, '文字')
    console.log('生出力内容:', rawOutput.substring(0, 500) + (rawOutput.length > 500 ? '...' : ''))
    
    // JSON抽出とパース
    const jsonExtraction = extractJsonFromOutput(rawOutput);
    if (!jsonExtraction.success) {
      throw new Error(`JSON抽出失敗: ${jsonExtraction.error}`);
    }

    let parsedData
    try {
      parsedData = JSON.parse(jsonExtraction.json)
      
      // パース後のデータ構造をログ
      console.log('パース済みデータ:')
      console.log('- items配列長:', parsedData?.items?.length || 0)
      console.log('- 期待値:', questionCount)
      
      // スキーマ検証
      const schemaValidation = validateInterviewSchema(parsedData, questionCount);
      logValidationResult(schemaValidation, 'LLM初回出力');
      
      if (!schemaValidation.isValid) {
        console.warn('⚠️ スキーマ検証失敗 - リペア試行')
        console.log('スキーマエラー:', schemaValidation.errors.slice(0, 3))
        
        // リペアプロンプトで再生成を試行
        throw new Error(`Schema validation failed: ${schemaValidation.errors.join('; ')}`)
      }
    } catch (parseError) {
      console.error('JSON パースエラー:', parseError)
      console.error('Raw output:', rawOutput)
      
      // パースエラーの場合はフォールバック（全て未回答）
      parsedData = {
        items: questions.map(q => ({
          question: q,
          answer: null,
          status: 'unanswered',
          evidence: []
        }))
      }
    }

    return { 
      structuredSummary: parsedData,
      rawOutput,
      success: true 
    }

  } catch (error) {
    console.error('OpenAI API error in summarizeInterview:', error)
    
    // エラー時のフォールバック
    const fallbackData = {
      items: questions.map(q => ({
        question: q,
        answer: null,
        status: 'unanswered' as const,
        evidence: []
      }))
    }
    
    return {
      structuredSummary: fallbackData,
      rawOutput: '',
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー'
    }
  }
}

/**
 * 厳密なバリデーション機能付きインタビュー抽出
 */
export const extractStructuredInterview = async (
  transcription: string, 
  questions: string[],
  options: InterviewExtractionOptions = {
    strict_no_autofill: true,
    exact_length_output: true,
    unanswered_token: '未回答'
  }
): Promise<{
  summary: StructuredInterviewSummary
  metadata: {
    success: boolean
    rawOutput: string
    repairAttempted: boolean
    validationPassed: boolean
    debugInfo?: string
    error?: string
  }
}> => {
  try {
    console.log(`開始: 構造化インタビュー抽出 (質問数: ${questions.length})`)

    // 第1回目の抽出試行
    let firstAttempt = await summarizeInterview(transcription, questions)
    let repairAttempted = false;
    
    if (!firstAttempt.success) {
      console.error('初回抽出に失敗:', firstAttempt.error)
      
      // リペア試行
      if (firstAttempt.rawOutput && firstAttempt.error?.includes('Schema validation failed')) {
        console.log('🔧 スキーマエラー検出 - リペア試行中...')
        const repairPrompt = generateRepairPrompt(
          null, // parsedDataがない場合
          firstAttempt.error ? [firstAttempt.error] : ['初回抽出失敗'],
          questions.length,
          transcription,
          questions
        );
        
        // リペア実行（simplified version）
        try {
          const repairResult = await summarizeInterviewWithCustomPrompt(repairPrompt);
          if (repairResult.success) {
            console.log('✅ リペア成功');
            // 型を合わせるために修正
            firstAttempt = {
              structuredSummary: repairResult.structuredSummary,
              rawOutput: repairResult.rawOutput,
              success: repairResult.success,
              error: repairResult.error || undefined
            };
            repairAttempted = true;
          }
        } catch (repairError) {
          console.error('❌ リペア失敗:', repairError);
        }
      }
      
      if (!firstAttempt.success) {
        const normalizedResult = normalizeInterviewSummary({
          items: [],
          questions: questions.map((q, i) => ({ 
            id: `q_${i+1}`, 
            content: q, 
            order: i+1,
            projectId: 'fallback',
            createdAt: new Date()
          })),
          transcript: transcription
        });
        
        return {
          summary: { items: normalizedResult.items },
          metadata: {
            success: false,
            rawOutput: firstAttempt.rawOutput,
            repairAttempted,
            validationPassed: false,
            error: firstAttempt.error
          }
        }
      }
    }

    // スキーマ検証
    const validation = validateInterviewSummary(firstAttempt.structuredSummary, questions.length)
    
    if (validation.isValid) {
      console.log('✅ 初回抽出成功、バリデーション合格')
      const normalizedResult = normalizeInterviewSummary({
        items: firstAttempt.structuredSummary.items || [],
        questions: questions.map((q, i) => ({ 
          id: `q_${i+1}`, 
          content: q, 
          order: i+1,
          projectId: 'extract',
          createdAt: new Date()
        })),
        transcript: transcription
      })
      
      return {
        summary: { items: normalizedResult.items },
        metadata: {
          success: true,
          rawOutput: firstAttempt.rawOutput,
          repairAttempted,
          validationPassed: true
        }
      }
    }

    // バリデーション失敗 → 修復試行
    console.log('⚠️ 初回バリデーション失敗、修復を試行:', validation.violations)
    
    const repairPrompt = generateRepairPrompt(
      firstAttempt.structuredSummary,
      validation.violations,
      questions.length,
      transcription,
      questions
    )

    const repairAttempt = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "あなたはインタビューQA抽出器です。スキーマ違反を修正して正しいJSONを出力してください。"
        },
        {
          role: "user", 
          content: repairPrompt
        }
      ],
      max_output_tokens: 12000,
    })

    const repairRawOutput = repairAttempt.output_text || ''
    let repairedData
    
    try {
      const jsonMatch = repairRawOutput.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? jsonMatch[0] : repairRawOutput
      repairedData = JSON.parse(jsonString)
    } catch (repairParseError) {
      console.error('修復後もJSON パースエラー:', repairParseError)
      repairedData = null
    }

    // 修復後の再検証
    const repairValidation = repairedData ? 
      validateInterviewSummary(repairedData, questions.length) : 
      { isValid: false, violations: ['JSON パース失敗'] }

    if (repairValidation.isValid) {
      console.log('✅ 修復成功、バリデーション合格')
      const normalizedResult = normalizeInterviewSummary({
        items: repairedData.items || [],
        questions: questions.map((q, i) => ({ 
          id: `q_${i+1}`, 
          content: q, 
          order: i+1,
          projectId: 'repaired',
          createdAt: new Date()
        })),
        transcript: transcription
      })
      
      return {
        summary: { items: normalizedResult.items },
        metadata: {
          success: true,
          rawOutput: `初回: ${firstAttempt.rawOutput}\n修復後: ${repairRawOutput}`,
          repairAttempted: true,
          validationPassed: true
        }
      }
    }

    // 修復も失敗 → 防御的正規化
    console.log('❌ 修復失敗、防御的正規化を実行')
    const fallbackData = repairedData || firstAttempt.structuredSummary || { items: [] };
    const normalizedResult = normalizeInterviewSummary({
      items: fallbackData.items || [],
      questions: questions.map((q, i) => ({ 
        id: `q_${i+1}`, 
        content: q, 
        order: i+1,
        projectId: 'fallback',
        createdAt: new Date()
      })),
      transcript: transcription
    })

    const debugInfo = generateDebugInfo(
      repairedData || firstAttempt.structuredSummary,
      questions,
      transcription
    )

    return {
      summary: { items: normalizedResult.items },
      metadata: {
        success: false,
        rawOutput: `初回: ${firstAttempt.rawOutput}\n修復後: ${repairRawOutput}`,
        repairAttempted: true,
        validationPassed: false,
        debugInfo,
        error: `修復後も検証失敗: ${repairValidation.violations.join(', ')}`
      }
    }

  } catch (error) {
    console.error('構造化インタビュー抽出で予期しないエラー:', error)
    
    const fallbackResult = normalizeInterviewSummary({
      items: [],
      questions: questions.map((q, i) => ({ 
        id: `q_${i+1}`, 
        content: q, 
        order: i+1,
        projectId: 'error-fallback',
        createdAt: new Date()
      })),
      transcript: transcription
    })
    
    return {
      summary: { items: fallbackResult.items },
      metadata: {
        success: false,
        rawOutput: '',
        repairAttempted: false,
        validationPassed: false,
        error: error instanceof Error ? error.message : '不明なエラー'
      }
    }
  }
}

export const generateFollowUpQuestion = async (originalQuestion: string, answer: string) => {
  try {
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "あなたは専門的なインタビュアーです。元の質問と回答を分析し、回答内容をより深掘りするための追加質問を1つ生成してください。具体例、背景、詳細、経験談、課題、解決策などに焦点を当てた質問を作成してください。質問のみを返してください。"
        },
        {
          role: "user",
          content: `元の質問: ${originalQuestion}\n\n回答: ${answer}\n\n上記の回答をより深掘りするための追加質問を1つ生成してください。`
        }
      ],
      max_output_tokens: 12000,
    })

    const content = completion.output_text || ''
    if (!content) {
      throw new Error('OpenAIから応答がありませんでした')
    }

    return content.trim()
  } catch (error) {
    console.error('OpenAI API error in generateFollowUpQuestion:', error)
    throw new Error(`深掘り質問生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}

export const generateOutlineAndMeta = async (
  articleType: ArticleType,
  theme: string,
  interviewee: string,
  transcript: string,
  language: 'ja' | 'en' = 'ja',
  tone: string = 'Professional'
): Promise<{ outline: OutlineSection[], meta: BlogMeta | HowToMeta }> => {
  try {
    const isHowTo = articleType === 'HOW_TO_GUIDE'
    
    const systemPrompt = isHowTo 
      ? `あなたは日本語の編集者です。与えられたインタビュー記録から、HOW_TO_GUIDE に最適化されたアウトラインとメタ情報を抽出・構造化します。事実はトランスクリプトに忠実に。冗長・反復は避けてください。`
      : `あなたは日本語の編集者です。与えられたインタビュー記録から、BLOG_POST に最適化されたアウトラインとメタ情報を抽出・構造化します。事実はトランスクリプトに忠実に。冗長・反復は避けてください。`

    const userPrompt = isHowTo 
      ? `Article Type: HOW_TO_GUIDE
Title: ${theme}
Theme: ${theme}
Tone: ${tone}
Language: ${language}

Transcript:
${transcript}

要件:
- 前提条件(prerequisites)、材料(materials)、所要時間(timeRequired)、難易度(difficulty)を抽出
- ステップは 5-12 個、order を1から連番。各 step は {goal, action, validation, warnings?, notes?}
- 代表的な失敗例と対処(troubleshooting)を2-5件
- FAQ(3-5)・CTA(1)
- 出力は JSON (outline[], meta{...上記})

重要: 返答はJSONのみにしてください。コードブロックや説明文は含めないでください。以下のJSONフォーマットで返してください:
{
  "outline": [
    {"id": "intro", "order": 1, "heading": "このガイドでできること", "sectionType": "intro"},
    {"id": "prereq", "order": 2, "heading": "前提条件と必要なもの", "sectionType": "prerequisites"},
    {"id": "steps", "order": 3, "heading": "手順", "sectionType": "steps"},
    {"id": "troubleshooting", "order": 4, "heading": "トラブルシュート", "sectionType": "troubleshooting"},
    {"id": "faq", "order": 5, "heading": "FAQ", "sectionType": "faq"},
    {"id": "cta", "order": 6, "heading": "次のアクション", "sectionType": "cta"}
  ],
  "meta": {
    "prerequisites": ["前提条件1", "前提条件2"],
    "materials": ["材料1", "材料2"],
    "timeRequired": "45分",
    "difficulty": "Medium",
    "steps": [
      {"order": 1, "goal": "目的", "action": "やること", "validation": "確認方法"}
    ],
    "troubleshooting": [
      {"problem": "問題", "fix": "解決策"}
    ],
    "faq": [
      {"q": "質問", "a": "回答"}
    ],
    "cta": "次のアクション"
  }
}`
      : `Article Type: BLOG_POST
Title: ${theme}
Theme: ${theme}
Tone: ${tone}
Language: ${language}

Transcript:
${transcript}

要件:
- 構成: 導入 / 背景と課題 / セクション(H2/H3 3-6本) / まとめ / FAQ(3-5) / CTA(1)
- "主張(thesis)" と "keyPoints(根拠)" を抽出
- セクション見出しは検索意図を意識し、重複や曖昧語を避ける
- 出力は JSON (outline[], meta{thesis,keyPoints[],faq[],cta})

重要: 返答はJSONのみにしてください。コードブロックや説明文は含めないでください。以下のJSONフォーマットで返してください:
{
  "outline": [
    {"id": "intro", "order": 1, "heading": "導入", "sectionType": "intro"},
    {"id": "background", "order": 2, "heading": "背景と課題", "sectionType": "background"},
    {"id": "h2-1", "order": 3, "heading": "主要トピック1", "sectionType": "section"},
    {"id": "h2-2", "order": 4, "heading": "主要トピック2", "sectionType": "section"},
    {"id": "h2-3", "order": 5, "heading": "主要トピック3", "sectionType": "section"},
    {"id": "summary", "order": 6, "heading": "まとめ", "sectionType": "summary"},
    {"id": "faq", "order": 7, "heading": "FAQ", "sectionType": "faq"},
    {"id": "cta", "order": 8, "heading": "CTA", "sectionType": "cta"}
  ],
  "meta": {
    "thesis": "主張",
    "keyPoints": ["根拠1", "根拠2", "根拠3"],
    "faq": [
      {"q": "質問", "a": "回答"}
    ],
    "cta": "行動喚起"
  }
}`

    console.log('=== OpenAI API Debug Info ===')
    console.log('Function: generateOutlineAndMeta')
    console.log('Model:', "gpt-5-mini")
    console.log('System prompt length:', systemPrompt.length)
    console.log('User prompt length:', userPrompt.length)
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY)
    console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...')
    
    let completion;
    try {
      completion = await openai.responses.create({
        model: "gpt-5-mini",
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_output_tokens: 12000,
      })

      console.log('=== OpenAI Responses API Success ===')
      console.log('Response status: SUCCESS')
      console.log('Response object keys:', Object.keys(completion))
      console.log('Output length:', completion.output?.length)
      console.log('Full response object:', JSON.stringify(completion, null, 2))
    } catch (apiError) {
      console.log('=== OpenAI Responses API Error ===')
      console.log('Error type:', typeof apiError)
      console.log('Error constructor:', apiError?.constructor?.name)
      console.log('Error message:', (apiError as any)?.message)
      console.log('Error status:', (apiError as any)?.status)
      console.log('Error code:', (apiError as any)?.code)
      console.log('Error type field:', (apiError as any)?.type)
      console.log('Error response headers:', (apiError as any)?.headers)
      console.log('Full error object:', JSON.stringify(apiError, Object.getOwnPropertyNames(apiError), 2))
      throw apiError
    }
    
    const content = completion.output_text || ''
    console.log('Extracted content:', content)
    
    if (!content) {
      console.error('No content in OpenAI response')
      console.error('Full completion:', completion)
      throw new Error('OpenAIから応答がありませんでした')
    }

    // Remove markdown code block markers if present
    let cleanedContent = content.trim()
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\n?/, '')
    }
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\n?/, '')
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.replace(/\n?```$/, '')
    }

    try {
      const result = JSON.parse(cleanedContent)
      return result
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw content:', content)
      console.error('Cleaned content:', cleanedContent)
      
      // Fallback to skeleton structure
      console.log('Using fallback skeleton structure')
      const fallbackOutline = isHowTo ? [...HOWTO_OUTLINE_SKELETON] : [...BLOG_OUTLINE_SKELETON]
      const fallbackMeta = isHowTo 
        ? {
            prerequisites: ['基本的なコンピュータスキル'],
            materials: ['コンピュータ', 'インターネット接続'],
            timeRequired: '30分',
            difficulty: 'Medium' as const,
            steps: [
              { order: 1, goal: '準備', action: '必要なツールを用意する', validation: 'ツールが揃っていることを確認' }
            ],
            troubleshooting: [
              { problem: '問題が発生した場合', fix: '手順を再確認してください' }
            ],
            faq: [
              { q: 'よくある質問1', a: '回答1' },
              { q: 'よくある質問2', a: '回答2' },
              { q: 'よくある質問3', a: '回答3' }
            ],
            cta: '次のステップに進む'
          }
        : {
            thesis: `${theme}に関する重要な洞察`,
            keyPoints: ['ポイント1', 'ポイント2', 'ポイント3'],
            faq: [
              { q: 'よくある質問1', a: '回答1' },
              { q: 'よくある質問2', a: '回答2' },
              { q: 'よくある質問3', a: '回答3' }
            ],
            cta: '詳細についてお問い合わせください'
          }
      
      return {
        outline: fallbackOutline,
        meta: fallbackMeta
      }
    }
  } catch (error) {
    console.error('OpenAI API error in generateOutlineAndMeta:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Return fallback structure instead of throwing
    console.log('Returning fallback structure due to error')
    const isHowTo = articleType === 'HOW_TO_GUIDE'
    const fallbackOutline = isHowTo ? [...HOWTO_OUTLINE_SKELETON] : [...BLOG_OUTLINE_SKELETON]
    const fallbackMeta = isHowTo 
      ? {
          prerequisites: ['基本的なコンピュータスキル'],
          materials: ['コンピュータ', 'インターネット接続'],
          timeRequired: '30分',
          difficulty: 'Medium' as const,
          steps: [
            { order: 1, goal: '準備', action: '必要なツールを用意する', validation: 'ツールが揃っていることを確認' }
          ],
          troubleshooting: [
            { problem: '問題が発生した場合', fix: '手順を再確認してください' }
          ],
          faq: [
            { q: 'よくある質問1', a: '回答1' },
            { q: 'よくある質問2', a: '回答2' },
            { q: 'よくある質問3', a: '回答3' }
          ],
          cta: '次のステップに進む'
        }
      : {
          thesis: `${theme}に関する重要な洞察`,
          keyPoints: ['ポイント1', 'ポイント2', 'ポイント3'],
          faq: [
            { q: 'よくある質問1', a: '回答1' },
            { q: 'よくある質問2', a: '回答2' },
            { q: 'よくある質問3', a: '回答3' }
          ],
          cta: '詳細についてお問い合わせください'
        }
    
    return {
      outline: fallbackOutline,
      meta: fallbackMeta
    }
  }
}

export const generateArticleContent = async (
  articleType: ArticleType,
  theme: string,
  outline: OutlineSection[],
  meta: BlogMeta | HowToMeta,
  language: 'ja' | 'en' = 'ja',
  tone: string = 'Professional'
): Promise<string> => {
  try {
    const systemPrompt = `あなたはプロのテクニカルライター/編集者です。提供されたアウトラインとメタを忠実に、自然な日本語でMarkdown本文を生成します。`

    const userPrompt = `Article Type: ${articleType}
Language: ${language}
Tone: ${tone}
Title: ${theme}

Data(JSON):
${JSON.stringify({ outline, meta }, null, 2)}

要件:
- 見出しレベル(H2/H3)を保持
- Blog: 背景→具体例→示唆の順で各H2を400-600字目安
- How-To: 手順は必ず番号付き。各手順に目的/操作/検証/注意の要素を含め、見出し直下に短いチェックリストを付ける
- 最後にFAQとCTAを付与
- 出力はMarkdown（本文のみ）`

    console.log('Calling OpenAI API for generateArticleContent...')
    
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_output_tokens: 12000,
    })

    const content = completion.output_text || ''
    if (!content) {
      console.error('No content in OpenAI response for generateArticleContent')
      console.error('Full completion response:', JSON.stringify(completion, null, 2))
      // Return fallback content with more details
      return `# ${theme}\n\n**注意**: OpenAI API から応答がありませんでした。以下はフォールバック記事です。\n\n## 概要\n\n${theme}について説明します。この記事は自動生成中にエラーが発生したため、代替コンテンツを表示しています。\n\n## 詳細情報が必要な場合\n\n- OpenAI APIキーの確認\n- ネットワーク接続の確認\n- APIの利用制限状況の確認\n\nをお試しください。\n\n## まとめ\n\n技術的な問題により、完全な記事を生成できませんでした。`
    }

    return content.trim()
  } catch (error) {
    console.error('OpenAI API error in generateArticleContent:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : error
    })
    
    // Return fallback content instead of throwing
    return `# ${theme}\n\n記事の生成中にエラーが発生しました。フォールバック記事を表示しています。\n\n## 概要\n\n${theme}について詳しく説明します。\n\n## まとめ\n\n以上が${theme}についての説明でした。`
  }
}

export const generateArticleDraft = async (
  theme: string,
  interviewee: string,
  summary: string,
  transcription: string
) => {
  try {
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: `あなたはプロの編集者・ライターです。以下の Q&A を素材として、PHASE0 品質基準を満たすブログ向けのインタビュー記事を作成してください。

# PHASE0 品質基準（必須）
**各H2セクションは以下を全て含むこと：**
1. **数字・データ** - 3個以上の具体的な数値（年数、金額、パーセント、期間など）
2. **固有名詞** - 2個以上の具体名（企業名、サービス名、技術名、地名など）
3. **箇条書き** - 必ず1つ以上の「・」「-」「*」による箇条書きリスト
4. **アクション語彙** - 行動、次の一手、チェックリスト、やってみる、ステップ、実践のいずれかを含む

# 出力要件
1. **記事タイトル**  
   - H1形式（# ）で開始し、30〜40文字で読者の興味を引くもの
2. **リード文**  
   - 3〜4行でインタビューの概要と読者メリットを提示
3. **本文構成**  
   - 3〜5個のH2見出しを **インタビュー内容に合わせて自動設計**
   - 各H2セクションは400〜600字で、上記PHASE0基準を必ず満たす
   - 回答を「」で短く引用しつつ、具体例・補足解説・実践的示唆を加える
4. **FAQ**  
   - H2「FAQ」として3個以上のH3質問を含める
5. **CTA**  
   - H2「CTA」または「次のアクション」で読者への行動喚起
6. **文体**  
   - です・ます調。専門用語には簡潔な補足を入れる

# 注意事項
- 回答者の個人情報は創作しない  
- Q&Aを単に羅列しない（必ず記事化する）
- 各セクションでPHASE0基準未達の場合は具体例を追補する
- 曖昧な表現より具体的データ・事例を優先する`
        },
        {
          role: "user",
          content: `# インタビュー情報
テーマ: ${theme}
インタビュイー: ${interviewee}

# Q&A素材
${transcription}

# 要約情報（参考）
${summary}

上記のQ&Aを素材として、指定された要件に従ってブログ向けのインタビュー記事を作成してください。記事タイトルから始めて、リード文、H2見出しによる本文構成、まとめまで含めた完全な記事を作成してください。`
        }
      ],
      max_output_tokens: 12000,
    })

    const content = completion.output_text || ''
    if (!content) {
      throw new Error('OpenAIから空の応答が返されました')
    }

    return content.trim()
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error(`記事生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}