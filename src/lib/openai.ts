import OpenAI from 'openai'
import { ArticleType, BlogMeta, HowToMeta, OutlineSection, BLOG_OUTLINE_SKELETON, HOWTO_OUTLINE_SKELETON } from '@/types'

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
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
    throw new Error(`アウトライン生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 4000,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAIから応答がありませんでした')
    }

    return content.trim()
  } catch (error) {
    console.error('OpenAI API error in generateArticleContent:', error)
    throw new Error(`記事生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
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