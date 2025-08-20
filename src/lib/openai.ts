import OpenAI from 'openai'

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
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは専門的なインタビュアーです。テーマとインタビュイーの情報に基づいて、5-7個の深掘りできる質問を日本語で生成してください。質問のみを1行ずつ、番号や記号なしで返してください。"
        },
        {
          role: "user",
          content: `テーマ: ${theme}\nインタビュイー: ${interviewee}\n\n上記の情報をもとに、日本語でインタビュー質問を作成してください。`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    console.log('OpenAI response received')
    const content = completion.choices[0]?.message?.content
    console.log('Raw content:', content)
    
    if (!content) {
      throw new Error('OpenAIから応答がありませんでした')
    }

    const questions = content.split('\n').filter(q => q.trim())
    console.log('Parsed questions:', questions)
    
    if (questions.length === 0) {
      throw new Error('質問が生成されませんでした')
    }
    
    return questions
  } catch (error) {
    console.error('OpenAI API error in generateQuestions:', error)
    throw new Error(`質問生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}

export const transcribeAudio = async (audioFile: File) => {
  try {
    console.log('Starting transcription for file:', audioFile.name, 'Size:', audioFile.size, 'Type:', audioFile.type)
    
    // Validate audio file
    if (!audioFile || audioFile.size === 0) {
      throw new Error('音声ファイルが空です')
    }
    
    if (audioFile.size > 25 * 1024 * 1024) { // 25MB limit for Whisper
      throw new Error('音声ファイルが大きすぎます（25MB以下にしてください）')
    }
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "ja", // Japanese, adjust as needed
      response_format: "text",
    })

    console.log('Transcription completed successfully')
    return transcription
  } catch (error) {
    console.error('Transcription error:', error)
    throw new Error(`音声の文字起こしに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}

export const summarizeInterview = async (transcription: string, questions: string[]) => {
  const questionsText = questions.map((q, i) => `Q${i + 1}: ${q}`).join('\n')
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "あなたは専門的なコンテンツアナリストです。インタビューの内容を分析し、重要な洞察や質問への回答をハイライトした構造化された要約を日本語で作成してください。Q&A形式で主要なポイントを整理してください。"
      },
      {
        role: "user",
        content: `質問:\n${questionsText}\n\nインタビュー文字起こし:\n${transcription}\n\n上記の内容を日本語で要約してください。`
      }
    ],
    temperature: 0.3,
  })

  return completion.choices[0]?.message?.content || ''
}

export const generateFollowUpQuestion = async (originalQuestion: string, answer: string) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは専門的なインタビュアーです。元の質問と回答を分析し、回答内容をより深掘りするための追加質問を1つ生成してください。具体例、背景、詳細、経験談、課題、解決策などに焦点を当てた質問を作成してください。質問のみを返してください。"
        },
        {
          role: "user",
          content: `元の質問: ${originalQuestion}\n\n回答: ${answer}\n\n上記の回答をより深掘りするための追加質問を1つ生成してください。`
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAIから応答がありませんでした')
    }

    return content.trim()
  } catch (error) {
    console.error('OpenAI API error in generateFollowUpQuestion:', error)
    throw new Error(`深掘り質問生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}

export const generateArticleDraft = async (
  theme: string,
  interviewee: string,
  summary: string,
  transcription: string
) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `あなたはプロの編集者・ライターです。以下の Q&A を素材として、ブログ向けのインタビュー記事を作成してください。

# 出力要件
1. **記事タイトル**  
   - 30〜40 文字で読者の興味を引くもの
2. **リード文**  
   - 3〜4 行でインタビューの概要と読者メリットを提示
3. **本文構成**  
   - 3〜5 個の H2 見出しを **インタビュー内容に合わせて自動設計** してください。  
     例）  
       ・背景や経歴に触れる導入  
       ・印象的なエピソードや課題  
       ・得られた学び・気づき  
       ・今後のビジョンやアドバイス  
   - 見出し名・順序・数は Q&A のテーマと流れに基づき最適化すること  
   - 各セクション内で回答を「」で短く引用しつつ、要約・補足解説・具体例を加える
4. **まとめ**  
   - 読者への学び／行動喚起（CTA）で締める
5. **文体**  
   - です・ます調。専門用語には簡潔な補足を入れる
6. **文字数目安**  
   - 1,500〜2,500 字
7. **読みやすさ**  
   - 同じ表現の繰り返しを避け、段落を適切に分ける
8. **表・箇条書き**  
   - 必要最小限とし、冗長な表組みは避ける

# 注意事項
- 回答者の個人情報は創作しない  
- Q&A を単に羅列しない（必ず記事化する）  
- 過度な数字の羅列や冗長な引用を避ける`
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
      temperature: 0.5,
      max_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAIから空の応答が返されました')
    }

    return content.trim()
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error(`記事生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
  }
}