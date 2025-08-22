import { describe, it, expect, beforeEach } from 'vitest'
import { makeLLMStub, LLMStubMode, generateInterviewNotesWithDI } from './helpers/llmStub'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { StructuredInterviewSummary, InterviewItem } from '@/types'

// テストフィクスチャの読み込み
const fixtures = {
  basic: {
    questions: JSON.parse(readFileSync(join(__dirname, 'fixtures/questions.basic.json'), 'utf8')),
    transcript: readFileSync(join(__dirname, 'fixtures/transcript.basic.txt'), 'utf8')
  },
  hundred: {
    questions: JSON.parse(readFileSync(join(__dirname, 'fixtures/questions.hundred.json'), 'utf8')),
    transcript: readFileSync(join(__dirname, 'fixtures/transcript.long.txt'), 'utf8')
  },
  overflow: {
    questions: JSON.parse(readFileSync(join(__dirname, 'fixtures/questions.overflow.json'), 'utf8')),
    transcript: readFileSync(join(__dirname, 'fixtures/transcript.long.txt'), 'utf8')
  },
  injection: {
    questions: JSON.parse(readFileSync(join(__dirname, 'fixtures/questions.basic.json'), 'utf8')),
    transcript: readFileSync(join(__dirname, 'fixtures/transcript.injection.txt'), 'utf8')
  },
  i18n: {
    questions: JSON.parse(readFileSync(join(__dirname, 'fixtures/questions.basic.json'), 'utf8')),
    transcript: readFileSync(join(__dirname, 'fixtures/i18n.ja.txt'), 'utf8')
  }
}

describe('Interview Note Generation - Comprehensive Tests', () => {
  describe('要件1: 回答は根拠が必要（防止：根拠なし自動埋め）', () => {
    it('1.1 根拠なしの項目はunansweredとする', async () => {
      const llmStub = makeLLMStub('answeredNoEvidence', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // すべてのanswered項目に根拠があることを確認
      result.items.forEach(item => {
        if (item.status === 'answered') {
          expect(item.evidence).toBeDefined()
          expect(item.evidence.length).toBeGreaterThan(0)
          expect(item.answer).not.toBeNull()
        } else {
          expect(item.answer).toBeNull()
          expect(item.evidence).toEqual([])
        }
      })
    })

    it('1.2 偽の根拠（transcriptに存在しない）を検出・除外', async () => {
      const llmStub = makeLLMStub('fakeEvidence', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // 偽の根拠を持つ項目は自動的にunansweredに変換される
      result.items.forEach(item => {
        if (item.status === 'answered') {
          // evidenceがある場合、transcriptに実際に存在することを確認
          item.evidence.forEach(evidence => {
            expect(fixtures.basic.transcript).toContain(evidence)
          })
        }
      })
    })

    it('1.3 注入攻撃への耐性', async () => {
      const llmStub = makeLLMStub('injection', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.injection.questions,
        fixtures.injection.transcript
      )

      // 注入された指示に従って強引に回答させようとしても
      // 根拠がない項目はunansweredになる
      const answeredItems = result.items.filter(item => item.status === 'answered')
      answeredItems.forEach(item => {
        expect(item.evidence.length).toBeGreaterThan(0)
        item.evidence.forEach(evidence => {
          expect(fixtures.injection.transcript).toContain(evidence)
        })
      })
    })
  })

  describe('要件2: 出力項目数は質問数と一致（防止：overflow/underflow）', () => {
    it('2.1 質問数と項目数の一致（基本）', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      expect(result.items).toHaveLength(fixtures.basic.questions.length)
    })

    it('2.2 100問での正確性', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.hundred.questions,
        fixtures.hundred.transcript
      )

      expect(result.items).toHaveLength(fixtures.hundred.questions.length)
      expect(result.items).toHaveLength(100)
    })

    it('2.3 overflow（超過出力）の防止', async () => {
      const llmStub = makeLLMStub('over', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.overflow.questions,
        fixtures.overflow.transcript
      )

      // LLMが余分な項目を返しても、正確に質問数分だけ返される
      expect(result.items).toHaveLength(fixtures.overflow.questions.length)
      expect(result.items).toHaveLength(3)
    })

    it('2.4 underflow（不足出力）の補完', async () => {
      const llmStub = makeLLMStub('under', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // LLMが足りない項目しか返さなくても、全質問分の項目が返される
      expect(result.items).toHaveLength(fixtures.basic.questions.length)
      
      // 不足分はunansweredとして補完される
      const unansweredItems = result.items.filter(item => item.status === 'unanswered')
      expect(unansweredItems.length).toBeGreaterThan(0)
    })
  })

  describe('エッジケース', () => {
    it('3.1 空の質問配列', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        [],
        fixtures.basic.transcript
      )

      expect(result.items).toHaveLength(0)
    })

    it('3.2 空のtranscript', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        ''
      )

      expect(result.items).toHaveLength(fixtures.basic.questions.length)
      // 空のtranscriptでは根拠が見つからないため、すべてunanswered
      result.items.forEach(item => {
        expect(item.status).toBe('unanswered')
        expect(item.answer).toBeNull()
        expect(item.evidence).toEqual([])
      })
    })

    it('3.3 非JSON出力の処理', async () => {
      const llmStub = makeLLMStub('nonJSON', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // JSON以外の余計な文章があっても正常に処理される
      expect(result.items).toHaveLength(fixtures.basic.questions.length)
    })

    it('3.4 国際化対応（日本語）', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.i18n.questions,
        fixtures.i18n.transcript
      )

      expect(result.items).toHaveLength(fixtures.i18n.questions.length)
      
      // 日本語コンテンツでも正常に根拠の検証が行われる
      const answeredItems = result.items.filter(item => item.status === 'answered')
      answeredItems.forEach(item => {
        item.evidence.forEach(evidence => {
          expect(fixtures.i18n.transcript).toContain(evidence)
        })
      })
    })
  })

  describe('構造的検証', () => {
    it('4.1 各項目の必須フィールド', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      result.items.forEach((item, index) => {
        // 必須フィールドの存在確認
        expect(item).toHaveProperty('question')
        expect(item).toHaveProperty('answer')
        expect(item).toHaveProperty('status')
        expect(item).toHaveProperty('evidence')

        // 質問の一致確認
        expect(item.question).toBe(fixtures.basic.questions[index])

        // status の値検証
        expect(['answered', 'unanswered']).toContain(item.status)

        // evidence の型検証
        expect(Array.isArray(item.evidence)).toBe(true)
      })
    })

    it('4.2 answered項目の一貫性', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      result.items.forEach(item => {
        if (item.status === 'answered') {
          expect(item.answer).not.toBeNull()
          expect(item.answer).toBeTruthy()
          expect(item.evidence.length).toBeGreaterThan(0)
        }
      })
    })

    it('4.3 unanswered項目の一貫性', async () => {
      const llmStub = makeLLMStub('answeredNoEvidence', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      result.items.forEach(item => {
        if (item.status === 'unanswered') {
          expect(item.answer).toBeNull()
          expect(item.evidence).toEqual([])
        }
      })
    })
  })

  describe('パフォーマンス', () => {
    it('5.1 大量質問での処理時間', async () => {
      const start = Date.now()
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.hundred.questions,
        fixtures.hundred.transcript
      )
      const duration = Date.now() - start

      expect(result.items).toHaveLength(100)
      // スタブなので高速処理を期待（実LLM時は除外）
      expect(duration).toBeLessThan(1000) // 1秒以内
    })
  })

  describe('決定性', () => {
    it('6.1 同一入力での同一出力', async () => {
      const llmStub1 = makeLLMStub('normal', 42)
      const llmStub2 = makeLLMStub('normal', 42)

      const result1 = await generateInterviewNotesWithDI(
        llmStub1,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )
      const result2 = await generateInterviewNotesWithDI(
        llmStub2,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      expect(result1).toEqual(result2)
    })

    it('6.2 異なるシードでの異なる出力', async () => {
      const llmStub1 = makeLLMStub('fuzzy', 42)
      const llmStub2 = makeLLMStub('fuzzy', 123)

      const result1 = await generateInterviewNotesWithDI(
        llmStub1,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )
      const result2 = await generateInterviewNotesWithDI(
        llmStub2,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // ファジーモードでは異なるシードで異なる結果になることを確認
      expect(result1).not.toEqual(result2)
      // ただし構造的要件は満たす
      expect(result1.items).toHaveLength(fixtures.basic.questions.length)
      expect(result2.items).toHaveLength(fixtures.basic.questions.length)
    })
  })
})