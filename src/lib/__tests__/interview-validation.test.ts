/**
 * インタビュー抽出機能のテスト
 * 要求仕様に基づくケースA/B/C
 */

import { 
  validateInterviewSummary, 
  normalizeInterviewSummary,
  generateRepairPrompt 
} from '../interview-validation'
import { validateEvidence } from '@/lib/interview-validation'
import { StructuredInterviewSummary, InterviewItem } from '@/types'

describe('Interview Validation Tests', () => {
  const mockQuestions = [
    "創業の背景について教えてください",
    "プロダクトマーケットフィットの過程を教えてください", 
    "チーム作りで重視したことは何ですか"
  ]

  const mockTranscript = `
    創業の背景については、前職でエンジニアとして働いていた時に課題を感じたことがきっかけです。
    多くの企業でデータ分析が適切に行われていないという問題がありました。
    そこで2019年に会社を設立し、データ分析プラットフォームの開発を開始しました。
    
    チーム作りでは技術力だけでなく、会社のビジョンに共感してくれる人材を重視しました。
    初期メンバーの採用では、実際の課題を一緒に解決してもらう実務テストを導入し、
    相性を確認するプロセスを設けました。結果として優秀なチームを構築できました。
  `

  // ケースA: 3問中2問のみ答えがあるトランスクリプト
  describe('ケースA: 部分的回答の処理', () => {
    test('2問に回答、1問は未回答として正しく処理される', () => {
      const mockData = {
        items: [
          {
            question: mockQuestions[0],
            answer: "前職でデータ分析の課題を感じ、2019年に会社を設立しました",
            status: "answered",
            evidence: ["前職でエンジニアとして働いていた時に課題を感じた", "2019年に会社を設立"]
          },
          {
            question: mockQuestions[1], 
            answer: null,
            status: "unanswered",
            evidence: []
          },
          {
            question: mockQuestions[2],
            answer: "技術力だけでなく、ビジョンに共感してくれる人材を重視しました",
            status: "answered", 
            evidence: ["会社のビジョンに共感してくれる人材を重視", "実務テストを導入"]
          }
        ]
      }

      const validation = validateInterviewSummary(mockData, mockQuestions.length)
      
      expect(validation.isValid).toBe(true)
      expect(validation.violations).toHaveLength(0)
      
      const normalized = normalizeInterviewSummary(mockData, mockQuestions, mockTranscript)
      
      expect(normalized.items).toHaveLength(3)
      expect(normalized.items.filter(item => item.status === 'answered')).toHaveLength(2)
      expect(normalized.items.filter(item => item.status === 'unanswered')).toHaveLength(1)
      
      // answered状態の項目は evidence >= 1
      normalized.items.forEach(item => {
        if (item.status === 'answered') {
          expect(item.evidence.length).toBeGreaterThanOrEqual(1)
        }
      })
    })
  })

  // ケースB: LLMが4件出力しようとする落とし穴
  describe('ケースB: 超過出力の正規化', () => {
    test('4件出力を3件に正規化', () => {
      const mockOverData = {
        items: [
          {
            question: mockQuestions[0],
            answer: "回答1",
            status: "answered",
            evidence: ["根拠1"]
          },
          {
            question: mockQuestions[1],
            answer: "回答2", 
            status: "answered",
            evidence: ["根拠2"]
          },
          {
            question: mockQuestions[2],
            answer: "回答3",
            status: "answered", 
            evidence: ["根拠3"]
          },
          {
            question: "余分な質問",
            answer: "余分な回答",
            status: "answered",
            evidence: ["余分な根拠"]
          }
        ]
      }

      const validation = validateInterviewSummary(mockOverData, mockQuestions.length)
      
      expect(validation.isValid).toBe(false)
      expect(validation.violations).toContain('項目数が期待値と異なります: 期待=3, 実際=4')
      
      const normalized = normalizeInterviewSummary(mockOverData, mockQuestions, mockTranscript)
      
      // 正規化後は期待される質問数ちょうど
      expect(normalized.items).toHaveLength(3)
      
      // 元の質問が保持されている
      normalized.items.forEach((item, index) => {
        expect(item.question).toBe(mockQuestions[index])
      })
    })
  })

  // ケースC: answered なのに evidence 空
  describe('ケースC: 無効なevidenceの自動ダウンシフト', () => {
    test('evidence空のansweredをunansweredにダウンシフト', () => {
      const mockBadData = {
        items: [
          {
            question: mockQuestions[0],
            answer: "根拠のない回答",
            status: "answered",
            evidence: [] // 空のevidence
          },
          {
            question: mockQuestions[1],
            answer: "存在しない根拠による回答",
            status: "answered",
            evidence: ["トランスクリプトにない文章"] // 偽のevidence
          },
          {
            question: mockQuestions[2],
            answer: null,
            status: "unanswered",
            evidence: []
          }
        ]
      }

      const validation = validateInterviewSummary(mockBadData, mockQuestions.length)
      
      expect(validation.isValid).toBe(false)
      expect(validation.violations).toContain('項目[0]: status=answered なのに evidence が空です')
      
      const normalized = normalizeInterviewSummary(mockBadData, mockQuestions, mockTranscript)
      
      // 無効なevidenceの項目は自動的にunansweredにダウンシフト
      expect(normalized.items[0].status).toBe('unanswered')
      expect(normalized.items[0].answer).toBe(null)
      expect(normalized.items[0].evidence).toHaveLength(0)
      
      expect(normalized.items[1].status).toBe('unanswered') // 偽evidenceもダウンシフト
      expect(normalized.items[1].answer).toBe(null)
    })
  })

  // Evidence真正性チェック
  describe('Evidence Validation', () => {
    test('有効なevidenceを正しく検証', () => {
      const validEvidence = ["前職でエンジニアとして働いていた", "会社のビジョンに共感"]
      const invalidEvidence = ["存在しない文章", "トランスクリプトにない内容"]
      
      expect(validateEvidence(validEvidence, mockTranscript)).toBe(true)
      expect(validateEvidence(invalidEvidence, mockTranscript)).toBe(false)
      expect(validateEvidence([], mockTranscript)).toBe(false)
    })
  })

  // 修復プロンプト生成
  describe('Repair Prompt Generation', () => {
    test('適切な修復プロンプトを生成', () => {
      const violations = ['項目数が期待値と異なります', 'evidence が空です']
      const prompt = generateRepairPrompt({}, violations, 3)
      
      expect(prompt).toContain('前回出力はスキーマ違反')
      expect(prompt).toContain('ちょうど 3')
      expect(prompt).toContain('項目数が期待値と異なります')
      expect(prompt).toContain('evidence が空です')
    })
  })

  // 設定オプション
  describe('Configuration Options', () => {
    test('strict_no_autofillが正しく動作', () => {
      const options = {
        strict_no_autofill: true,
        exact_length_output: true,
        unanswered_token: '未回答'
      }

      const emptyData = null
      const normalized = normalizeInterviewSummary(emptyData, mockQuestions, mockTranscript, options)
      
      // 全て未回答でパディング
      expect(normalized.items).toHaveLength(3)
      normalized.items.forEach(item => {
        expect(item.status).toBe('unanswered')
        expect(item.answer).toBe(null)
        expect(item.evidence).toHaveLength(0)
      })
    })
  })
})