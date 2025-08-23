import { describe, it, expect, beforeEach } from 'vitest'
import { clampAndNormalizeBlocks, validateQuestionCount, validateUnansweredBlocks } from '../src/lib/interview-validation'
import { stripHeadingsAndBullets, aggressiveClean, analyzePatternsFound } from '../src/lib/text/sanitize'
import { validateResponseStructure } from '../src/lib/prompt/interviewArticle'
import type { InterviewPayload, Question, Answer, InterviewBlock } from '../src/types/interview'

describe('JSON入出力システム - 質問数制御テスト', () => {
  let basicPayload: InterviewPayload
  
  beforeEach(() => {
    const questions: Question[] = [
      { id: 'q1', order: 1, text: '創業の背景について教えてください' },
      { id: 'q2', order: 2, text: '事業モデルについて教えてください' },
      { id: 'q3', order: 3, text: 'チーム構成について教えてください' }
    ]
    
    const answers: Answer[] = [
      { questionId: 'q1', text: '前職で課題を感じて起業しました', hasEvidence: true },
      { questionId: 'q2', text: '', hasEvidence: false },
      { questionId: 'q3', text: 'エンジニア中心のチームです', hasEvidence: true }
    ]
    
    basicPayload = {
      questions,
      answers,
      context: '創業の背景は課題解決のため。チームはエンジニア中心。'
    }
  })

  describe('N-in / N-out 制御', () => {
    it('正確な質問数でのバリデーション通過', () => {
      const mockBlocks: InterviewBlock[] = [
        { order: 1, question: '創業の背景について教えてください', body: '課題解決のため起業' },
        { order: 2, question: '事業モデルについて教えてください', body: '未回答' },
        { order: 3, question: 'チーム構成について教えてください', body: 'エンジニア中心' }
      ]
      
      const result = clampAndNormalizeBlocks(basicPayload, mockBlocks)
      
      expect(result).toHaveLength(3)
      expect(result[0].body).not.toBe('未回答')
      expect(result[1].body).toBe('未回答') // hasEvidence=false
      expect(result[2].body).not.toBe('未回答')
    })

    it('LLMが7ブロック返すケース → 3ブロックにトリム', () => {
      const overflowBlocks: InterviewBlock[] = [
        { order: 1, question: '創業の背景について', body: '課題解決' },
        { order: 2, question: '事業モデルについて', body: '未回答' },
        { order: 3, question: 'チーム構成について', body: 'エンジニア' },
        { order: 4, question: '余分な質問1', body: '余分な回答1' },
        { order: 5, question: '余分な質問2', body: '余分な回答2' },
        { order: 6, question: '余分な質問3', body: '余分な回答3' },
        { order: 7, question: '余分な質問4', body: '余分な回答4' }
      ]
      
      const result = clampAndNormalizeBlocks(basicPayload, overflowBlocks)
      
      expect(result).toHaveLength(3)
      expect(result[0].question).toBe('創業の背景について教えてください')
      expect(result[1].question).toBe('事業モデルについて教えてください')
      expect(result[2].question).toBe('チーム構成について教えてください')
    })

    it('LLMが1ブロックしか返さないケース → 3ブロックに補完', () => {
      const underflowBlocks: InterviewBlock[] = [
        { order: 1, question: '創業について', body: '課題解決のため' }
      ]
      
      const result = clampAndNormalizeBlocks(basicPayload, underflowBlocks)
      
      expect(result).toHaveLength(3)
      expect(result[0].body).not.toBe('未回答')
      expect(result[1].body).toBe('未回答') // 補完 + hasEvidence=false
      expect(result[2].body).toBe('未回答') // 補完だが、実際はhasEvidence=trueなので後処理で修正される可能性
    })
  })

  describe('未回答項目の「未回答」固定', () => {
    it('hasEvidence=falseの項目は強制的に「未回答」', () => {
      const mockBlocks: InterviewBlock[] = [
        { order: 1, question: '創業について', body: '起業の経緯' },
        { order: 2, question: '事業について', body: '推測で書いた内容' }, // hasEvidence=false なのに内容あり
        { order: 3, question: 'チームについて', body: 'チーム構成' }
      ]
      
      const result = clampAndNormalizeBlocks(basicPayload, mockBlocks)
      
      expect(result[1].body).toBe('未回答') // 強制修正
    })

    it('「質問内容が見つかりません」を「未回答」に変換', () => {
      const mockBlocks: InterviewBlock[] = [
        { order: 1, question: '創業について', body: '起業経緯' },
        { order: 2, question: '事業について', body: '質問内容が見つかりません' },
        { order: 3, question: 'チームについて', body: 'チーム情報' }
      ]
      
      const result = clampAndNormalizeBlocks(basicPayload, mockBlocks)
      
      expect(result[1].body).toBe('未回答')
    })
  })

  describe('バリデーション関数', () => {
    it('質問数バリデーション - 正常ケース', () => {
      const blocks: InterviewBlock[] = [
        { order: 1, question: 'Q1', body: '回答1' },
        { order: 2, question: 'Q2', body: '回答2' },
        { order: 3, question: 'Q3', body: '回答3' }
      ]
      
      const result = validateQuestionCount(['Q1', 'Q2', 'Q3'], blocks)
      expect(result.isValid).toBe(true)
    })

    it('質問数バリデーション - 異常ケース', () => {
      const blocks: InterviewBlock[] = [
        { order: 1, question: 'Q1', body: '回答1' }
      ]
      
      const result = validateQuestionCount(['Q1', 'Q2', 'Q3'], blocks)
      expect(result.isValid).toBe(false)
      expect(result.message).toContain('質問数不一致')
    })

    it('未回答項目バリデーション', () => {
      const blocks: InterviewBlock[] = [
        { order: 1, question: '質問1', body: '正常な回答' },
        { order: 2, question: '質問2', body: '推測回答' }, // hasEvidence=falseなのに内容あり
        { order: 3, question: '質問3', body: '未回答' }
      ]
      
      const result = validateUnansweredBlocks(basicPayload, blocks)
      expect(result.isValid).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0]).toContain('Q2')
    })
  })

  describe('テキストサニタイズ', () => {
    it('見出しと箇条書きの除去', () => {
      const dirtyText = `
# 見出し1
## 見出し2
Q1: この行は除去されるべき
Q22: これも除去
- 箇条書き1
・ 箇条書き2
1. 番号付きリスト
① 丸数字リスト

通常のテキストは残る
こちらも残る
`.trim()
      
      const cleaned = stripHeadingsAndBullets(dirtyText)
      
      expect(cleaned).not.toContain('Q1:')
      expect(cleaned).not.toContain('Q22:')
      expect(cleaned).not.toContain('見出し')
      expect(cleaned).not.toContain('箇条書き')
      expect(cleaned).toContain('通常のテキスト')
      expect(cleaned).toContain('こちらも残る')
    })

    it('パターン分析機能', () => {
      const testText = `
Q1: 質問1
Q2: 質問2  
# 見出し
- 項目1
・ 項目2
① 項目3
② 項目4
`.trim()
      
      const analysis = analyzePatternsFound(testText)
      
      expect(analysis.qNumbers).toBe(2)
      expect(analysis.headings).toBe(1)
      expect(analysis.bullets).toBe(2)
      expect(analysis.circledNumbers).toBe(2)
    })

    it('強力クリーニング', () => {
      const contaminated = `
Q1: 創業について
何か通常のテキスト
Q15: 不要な質問
質問内容が見つかりません
もっと通常のテキスト


Q33: またもや不要
`.trim()
      
      const cleaned = aggressiveClean(contaminated)
      
      expect(cleaned).not.toContain('Q1:')
      expect(cleaned).not.toContain('Q15:')
      expect(cleaned).not.toContain('Q33:')
      expect(cleaned).not.toContain('質問内容が見つかりません')
      expect(cleaned).toContain('何か通常のテキスト')
      expect(cleaned).toContain('もっと通常のテキスト')
    })
  })

  describe('レスポンス構造バリデーション', () => {
    it('正常な構造のバリデーション', () => {
      const validResponse = {
        blocks: [
          { order: 1, question: '質問1', body: '回答1' },
          { order: 2, question: '質問2', body: '回答2' }
        ]
      }
      
      const result = validateResponseStructure(validResponse)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('不正な構造の検出', () => {
      const invalidResponse = {
        blocks: [
          { order: '1', question: '質問1', body: '回答1' }, // order が文字列
          { question: '質問2', body: '回答2' }             // order がない
        ]
      }
      
      const result = validateResponseStructure(invalidResponse)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})