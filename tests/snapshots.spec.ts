import { describe, it, expect } from 'vitest'
import { makeLLMStub } from './helpers/llmStub'
import { generateInterviewNotesWithDI } from './helpers/llmStub'
import { readFileSync } from 'fs'
import { join } from 'path'

// テストフィクスチャの読み込み
const fixtures = {
  basic: {
    questions: JSON.parse(readFileSync(join(__dirname, 'fixtures/questions.basic.json'), 'utf8')),
    transcript: readFileSync(join(__dirname, 'fixtures/transcript.basic.txt'), 'utf8')
  },
  overflow: {
    questions: JSON.parse(readFileSync(join(__dirname, 'fixtures/questions.overflow.json'), 'utf8')),
    transcript: readFileSync(join(__dirname, 'fixtures/transcript.long.txt'), 'utf8')
  }
}

describe('Snapshot Tests - Regression Detection', () => {
  describe('Core Scenarios', () => {
    it('基本シナリオ - 正常な根拠付き回答', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // 構造の確認
      expect(result.items).toHaveLength(fixtures.basic.questions.length)
      
      // スナップショット比較（回帰検出）
      expect(result).toMatchSnapshot('basic-scenario-normal')
    })

    it('Overflowシナリオ - 超過出力の正規化', async () => {
      const llmStub = makeLLMStub('over', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.overflow.questions,
        fixtures.overflow.transcript
      )

      // 質問数と一致することを確認
      expect(result.items).toHaveLength(fixtures.overflow.questions.length)
      expect(result.items).toHaveLength(3)
      
      // スナップショット比較
      expect(result).toMatchSnapshot('overflow-scenario-normalized')
    })

    it('Evidence-downshiftシナリオ - 根拠なし項目の適切な処理', async () => {
      const llmStub = makeLLMStub('answeredNoEvidence', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // 根拠なし項目はunansweredになることを確認
      result.items.forEach(item => {
        if (item.status === 'answered') {
          expect(item.evidence.length).toBeGreaterThan(0)
        } else {
          expect(item.answer).toBeNull()
          expect(item.evidence).toEqual([])
        }
      })
      
      // スナップショット比較
      expect(result).toMatchSnapshot('evidence-downshift-scenario')
    })
  })

  describe('Edge Cases Snapshots', () => {
    it('偽の根拠検出・除外', async () => {
      const llmStub = makeLLMStub('fakeEvidence', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      expect(result).toMatchSnapshot('fake-evidence-filtered')
    })

    it('注入攻撃耐性', async () => {
      const llmStub = makeLLMStub('injection', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      expect(result).toMatchSnapshot('injection-resistant')
    })

    it('非JSON出力の正規化', async () => {
      const llmStub = makeLLMStub('nonJSON', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      expect(result).toMatchSnapshot('non-json-normalized')
    })

    it('Underflow補完', async () => {
      const llmStub = makeLLMStub('under', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      expect(result.items).toHaveLength(fixtures.basic.questions.length)
      expect(result).toMatchSnapshot('underflow-completed')
    })
  })

  describe('Data Structure Snapshots', () => {
    it('項目構造の一貫性', async () => {
      const llmStub = makeLLMStub('normal', 42)
      const result = await generateInterviewNotesWithDI(
        llmStub,
        fixtures.basic.questions,
        fixtures.basic.transcript
      )

      // 個別項目の構造スナップショット
      const sampleItem = result.items[0]
      expect(sampleItem).toMatchSnapshot('item-structure')
      
      // 全体の型構造
      expect({
        itemCount: result.items.length,
        itemKeys: Object.keys(result.items[0] || {}),
        answeredCount: result.items.filter(i => i.status === 'answered').length,
        unansweredCount: result.items.filter(i => i.status === 'unanswered').length
      }).toMatchSnapshot('summary-structure')
    })
  })

  describe('Deterministic Behavior', () => {
    it('同一入力での同一出力（決定性）', async () => {
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

      // 完全一致することを確認
      expect(result1).toEqual(result2)
      
      // 決定性のスナップショット
      expect(result1).toMatchSnapshot('deterministic-output')
    })
  })
})