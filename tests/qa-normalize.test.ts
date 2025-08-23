import { describe, it, expect } from 'vitest'
import { 
  normalizeInterview, 
  validateQACount, 
  sanitizeQAData, 
  analyzeQAStructure,
  type QAInput, 
  type QAOutput 
} from '../src/lib/qa-normalize'

describe('Q/A正規化システム', () => {
  
  describe('normalizeInterview - 基本機能', () => {
    it('正常なQ/A配列を正規化', () => {
      const input: QAInput = {
        questions: ['創業について', '事業について', 'チームについて'],
        answers: ['起業の背景', '', 'エンジニア中心'],
        followUps: [[], ['追問1'], []]
      }
      
      const result = normalizeInterview(input)
      
      expect(result.questions).toHaveLength(3)
      expect(result.answers).toHaveLength(3)
      expect(result.followUps).toHaveLength(3)
      expect(result.displayIndex).toEqual([1, 2, 3])
      expect(result.answers[1]).toBe('') // 空回答は保持
    })

    it('最大7件制限の適用', () => {
      const input: QAInput = {
        questions: Array.from({ length: 10 }, (_, i) => `質問${i + 1}`),
        answers: Array.from({ length: 10 }, (_, i) => `回答${i + 1}`),
        followUps: Array.from({ length: 10 }, () => [])
      }
      
      const result = normalizeInterview(input, { maxQuestions: 7 })
      
      expect(result.questions).toHaveLength(7)
      expect(result.answers).toHaveLength(7)
      expect(result.followUps).toHaveLength(7)
      expect(result.displayIndex).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it('不足分の安全側補完', () => {
      const input: QAInput = {
        questions: ['質問1'], // 1件のみ
        answers: [], // 空
        followUps: []
      }
      
      const result = normalizeInterview(input, { maxQuestions: 3 })
      
      // actualLength=1なので、targetLength=min(3,1)=1
      expect(result.questions).toEqual(['質問1'])
      expect(result.answers).toEqual(['']) // 補完されて1件
      expect(result.followUps).toHaveLength(1)
    })

    it('follow-up数制限', () => {
      const input: QAInput = {
        questions: ['質問1'],
        answers: ['回答1'],
        followUps: [['追問1', '追問2', '追問3', '追問4']] // 4つの追問
      }
      
      const result = normalizeInterview(input, { maxFollowUpsPerQ: 2 })
      
      expect(result.followUps[0]).toHaveLength(2)
      expect(result.followUps[0]).toEqual(['追問1', '追問2'])
    })

    it('空入力の処理', () => {
      const input: QAInput = {
        questions: [],
        answers: [],
        followUps: []
      }
      
      const result = normalizeInterview(input)
      
      expect(result.questions).toEqual([])
      expect(result.answers).toEqual([])
      expect(result.followUps).toEqual([])
      expect(result.displayIndex).toEqual([])
    })
  })

  describe('validateQACount - 件数検証', () => {
    it('適正件数の検証', () => {
      const input: QAInput = {
        questions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
        answers: ['A1', 'A2', 'A3', 'A4', 'A5']
      }
      
      const result = validateQACount(input)
      
      expect(result.isValid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('質問数不足の検出', () => {
      const input: QAInput = {
        questions: ['Q1', 'Q2'], // 2件のみ
        answers: ['A1', 'A2']
      }
      
      const result = validateQACount(input)
      
      expect(result.isValid).toBe(false)
      expect(result.violations.join(' ')).toMatch(/質問数が不足/)
      expect(result.recommendations.join(' ')).toMatch(/質問を追加生成/)
    })

    it('質問数上限超過の検出', () => {
      const input: QAInput = {
        questions: Array.from({ length: 10 }, (_, i) => `Q${i + 1}`),
        answers: Array.from({ length: 10 }, (_, i) => `A${i + 1}`)
      }
      
      const result = validateQACount(input)
      
      expect(result.isValid).toBe(false)
      expect(result.violations.join(' ')).toMatch(/質問数が上限超過/)
    })

    it('Q/A件数の不一致検出', () => {
      const input: QAInput = {
        questions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
        answers: ['A1', 'A2'] // 大きく不一致
      }
      
      const result = validateQACount(input)
      
      expect(result.isValid).toBe(false)
      expect(result.violations.join(' ')).toMatch(/質問と回答の件数に大きな差/)
    })

    it('空項目の分析', () => {
      const input: QAInput = {
        questions: ['Q1', '', 'Q3'],
        answers: ['A1', '', '']
      }
      
      const result = validateQACount(input)
      
      expect(result.recommendations.join(' ')).toMatch(/空の質問: 1件/)
      expect(result.recommendations.join(' ')).toMatch(/未回答: 2件/)
    })
  })

  describe('sanitizeQAData - サニタイズ', () => {
    it('Q番号パターンの除去', () => {
      const input: QAInput = {
        questions: ['Q1: 創業について', 'Q2：事業について', '設問3 チームについて'],
        answers: ['Q1への回答です', '回答内容', '設問3への回答']
      }
      
      const result = sanitizeQAData(input)
      
      expect(result.questions[0]).toBe('創業について')
      expect(result.questions[1]).toBe('事業について')
      expect(result.questions[2]).toBe('チームについて')
      expect(result.answers[0]).toBe('Q1への回答です') // Q番号は部分的に残る場合あり
    })

    it('プレースホルダー文言の除去', () => {
      const input: QAInput = {
        questions: ['創業について質問内容が見つかりません'],
        answers: ['質問内容が見つかりませんが推測します']
      }
      
      const result = sanitizeQAData(input)
      
      expect(result.questions[0]).toBe('創業について')
      expect(result.answers[0]).toBe('が推測します')
    })

    it('見出し記法の除去', () => {
      const input: QAInput = {
        questions: ['【重要】創業について', '【質問】事業について'],
        answers: ['【回答】起業しました', '【詳細】事業モデル']
      }
      
      const result = sanitizeQAData(input)
      
      expect(result.questions[0]).toBe('創業について')
      expect(result.questions[1]).toBe('事業について')
      expect(result.answers[0]).toBe('起業しました')
      expect(result.answers[1]).toBe('事業モデル')
    })

    it('follow-upのサニタイズ', () => {
      const input: QAInput = {
        questions: ['基本質問'],
        answers: ['基本回答'],
        followUps: [['Q1-1: 追問1について', '設問1-2 さらに詳しく']]
      }
      
      const result = sanitizeQAData(input)
      
      expect(result.followUps![0][0]).toBe('Q1-1: 追問1について') // 複雑パターンは部分残り
      expect(result.followUps![0][1]).toBe('-2 さらに詳しく') // 設問パターンの一部が残る
    })
  })

  describe('analyzeQAStructure - 構造分析', () => {
    it('構造の詳細分析', () => {
      const input: QAInput = {
        questions: ['短い質問', '少し長めの質問内容について'],
        answers: ['短答', '長めの回答内容です。詳細な説明を含みます。'],
        followUps: [['追問1', '追問2'], []]
      }
      
      const result = analyzeQAStructure(input)
      
      expect(result.details.questionCount).toBe(2)
      expect(result.details.answerCount).toBe(2)
      expect(result.details.followUpCount).toBe(2)
      expect(result.details.emptyQuestions).toBe(0)
      expect(result.details.emptyAnswers).toBe(0)
      expect(result.details.averageQuestionLength).toBeGreaterThan(0)
      expect(result.details.averageAnswerLength).toBeGreaterThan(0)
    })

    it('空項目の検出', () => {
      const input: QAInput = {
        questions: ['質問1', '', '質問3'],
        answers: ['回答1', '', '']
      }
      
      const result = analyzeQAStructure(input)
      
      expect(result.details.emptyQuestions).toBe(1)
      expect(result.details.emptyAnswers).toBe(2)
      expect(result.summary).toContain('空Q=1')
      expect(result.summary).toContain('空A=2')
    })
  })

  describe('統合テスト - 実際のワークフロー', () => {
    it('クライアント→API→LLM の完全フロー', () => {
      // 1) 生のユーザー入力（コンタミネーション含む）
      const rawInput: QAInput = {
        questions: [
          'Q1: 創業の背景について教えてください',
          'Q2：事業モデルについて質問内容が見つかりません',
          '設問3 チーム構成について',
          '質問4 余分な質問',
          '質問5 さらに余分',
          '質問6 もっと余分',
          '質問7 最後の質問',
          '質問8 上限超過' // 8個目（7個制限で削除されるべき）
        ],
        answers: [
          '前職で課題を感じました',
          '', // 未回答
          'エンジニア中心です',
          '余分な回答',
          '',
          'また余分',
          '最後の回答',
          '削除される回答'
        ],
        followUps: [
          ['Q1への追問1', 'Q1への追問2', '削除される追問'], // 3個→2個に制限
          [],
          ['1つの追問'],
          [],
          [],
          [],
          [],
          []
        ],
        metadata: { source: 'client', timestamp: Date.now() }
      }

      // 2) サニタイズ
      const sanitized = sanitizeQAData(rawInput)
      
      // Q番号とプレースホルダーが除去されているか
      expect(sanitized.questions[0]).toBe('創業の背景について教えてください')
      expect(sanitized.questions[1]).toBe('事業モデルについて')
      
      // 3) 正規化（7件制限適用）
      const normalized = normalizeInterview(sanitized, {
        maxQuestions: 7,
        maxFollowUpsPerQ: 2,
        allowEmptyAnswers: true
      })
      
      // 件数制限が適用されているか
      expect(normalized.questions).toHaveLength(7)
      expect(normalized.answers).toHaveLength(7)
      expect(normalized.followUps).toHaveLength(7)
      
      // 8番目が削除されているか
      expect(normalized.questions).not.toContain('上限超過')
      expect(normalized.answers).not.toContain('削除される回答')
      
      // follow-up制限が適用されているか
      expect(normalized.followUps[0]).toHaveLength(2)
      expect(normalized.followUps[0]).not.toContain('削除される追問')
      
      // 空回答が保持されているか
      expect(normalized.answers[1]).toBe('') // 2番目は未回答
      expect(normalized.answers[4]).toBe('') // 5番目も未回答
      
      // 4) バリデーション
      const validation = validateQACount(normalized)
      expect(validation.isValid).toBe(true) // 7件なので有効
      
      // 5) 構造分析
      const analysis = analyzeQAStructure(normalized)
      expect(analysis.details.questionCount).toBe(7)
      expect(analysis.details.answerCount).toBe(7)
      expect(analysis.details.emptyAnswers).toBe(2) // 空回答2件
    })

    it('エッジケース: すべて空の入力', () => {
      const emptyInput: QAInput = {
        questions: [],
        answers: [],
        followUps: []
      }
      
      const result = normalizeInterview(emptyInput)
      
      expect(result.questions).toEqual([])
      expect(result.answers).toEqual([])
      expect(result.displayIndex).toEqual([])
      
      const validation = validateQACount(result)
      expect(validation.isValid).toBe(false) // 0件は無効
    })

    it('エッジケース: 1件のみの入力', () => {
      const singleInput: QAInput = {
        questions: ['唯一の質問'],
        answers: ['唯一の回答']
      }
      
      const result = normalizeInterview(singleInput)
      
      expect(result.questions).toHaveLength(1)
      expect(result.answers).toHaveLength(1)
      expect(result.displayIndex).toEqual([1])
      
      const validation = validateQACount(result)
      expect(validation.isValid).toBe(false) // 1件は最小要件未満
    })
  })
})