import { describe, it, expect, beforeAll } from 'vitest'
import { normalizeText, validateEvidence, validateEvidenceArray, analyzeEvidenceQuality } from '../src/lib/evidence-validation'
import { normalizeInterviewSummary } from '../src/lib/interview-normalization'
import { validateInterviewSchema } from '../src/lib/interview-schema'

// 修正ブリーフの受け入れ基準に対応する最重要テスト

describe('Evidence検証システム - 「回答しているのに未回答になる」誤判定防止', () => {

  describe('CountExact: 件数厳密制御', () => {
    it('items.length !== questions.length → normalize後は厳密にN', () => {
      const mockData = {
        items: [
          { question: '質問1', answer: '回答1', status: 'answered' as const, evidence: ['根拠1'] },
          { question: '質問2', answer: '回答2', status: 'answered' as const, evidence: ['根拠2'] },
          { question: '質問3', answer: '回答3', status: 'answered' as const, evidence: ['根拠3'] },
          { question: '余分な質問', answer: '余分', status: 'answered' as const, evidence: ['余分根拠'] }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() },
          { id: 'q2', content: '質問2', order: 2, projectId: 'test', createdAt: new Date() },
          { id: 'q3', content: '質問3', order: 3, projectId: 'test', createdAt: new Date() }
        ],
        transcript: '根拠1について話しています。根拠2の内容です。根拠3も含まれています。'
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items).toHaveLength(3); // 必ず質問数に一致
      expect(result.metadata.originalCount).toBe(4);
      expect(result.metadata.finalCount).toBe(3);
    });

    it('不足項目の補完（unansweredでパディング）', () => {
      const mockData = {
        items: [
          { question: '質問1', answer: '回答1', status: 'answered' as const, evidence: ['十分な長さの根拠テキスト'] }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() },
          { id: 'q2', content: '質問2', order: 2, projectId: 'test', createdAt: new Date() },
          { id: 'q3', content: '質問3', order: 3, projectId: 'test', createdAt: new Date() }
        ],
        transcript: '十分な長さの根拠テキストがここにあります。'
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].status).toBe('answered');
      expect(result.items[1].status).toBe('unanswered');
      expect(result.items[2].status).toBe('unanswered');
      expect(result.items[1].answer).toBe(null);
      expect(result.items[2].answer).toBe(null);
    });
  });

  describe('AnsweredNoEvidence: status:"answered" & evidence:[] → unansweredダウンシフト', () => {
    it('evidenceが空配列の場合は強制unanswered', () => {
      const mockData = {
        items: [
          { question: '質問1', answer: '実際は回答があるが', status: 'answered' as const, evidence: [] }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() }
        ],
        transcript: '何らかのトランスクリプト'
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items[0].status).toBe('unanswered');
      expect(result.items[0].answer).toBe(null);
      expect(result.metadata.downgradedCount).toBe(1);
    });

    it('evidenceが未定義の場合も強制unanswered', () => {
      const mockData = {
        items: [
          { question: '質問1', answer: '回答テキスト', status: 'answered' as const, evidence: undefined as any }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() }
        ],
        transcript: '何らかのトランスクリプト'
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items[0].status).toBe('unanswered');
      expect(result.items[0].answer).toBe(null);
    });
  });

  describe('EvidenceNotInTranscript: evidenceがtranscriptに未一致 → unanswered', () => {
    it('transcript内に存在しないevidenceは無効', () => {
      const transcript = '実際のトランスクリプト内容がここにあります。具体的な発言内容。';
      
      const mockData = {
        items: [
          { 
            question: '質問1', 
            answer: '回答', 
            status: 'answered' as const, 
            evidence: ['存在しない根拠テキスト', 'これも見つからない'] 
          }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() }
        ],
        transcript
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items[0].status).toBe('unanswered');
      expect(result.metadata.downgradedCount).toBe(1);
    });

    it('transcript内に存在するevidenceは有効', () => {
      const transcript = '実際のトランスクリプト内容がここにあります。具体的な発言内容について説明します。';
      
      const mockData = {
        items: [
          { 
            question: '質問1', 
            answer: '回答', 
            status: 'answered' as const, 
            evidence: ['実際のトランスクリプト内容がここにあります'] 
          }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() }
        ],
        transcript
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items[0].status).toBe('answered');
      expect(result.metadata.downgradedCount).toBe(0);
    });
  });

  describe('TinyEvidence: 短すぎるevidence → unanswered', () => {
    it('7文字以下のevidenceは無効', () => {
      const transcript = '短い根拠があります。';
      
      const mockData = {
        items: [
          { 
            question: '質問1', 
            answer: '回答', 
            status: 'answered' as const, 
            evidence: ['短い'] // 2文字
          }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() }
        ],
        transcript
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items[0].status).toBe('unanswered');
      expect(result.metadata.downgradedCount).toBe(1);
    });

    it('8文字以上のevidenceは有効', () => {
      const transcript = '十分な長さの根拠テキストがあります。';
      
      const mockData = {
        items: [
          { 
            question: '質問1', 
            answer: '回答', 
            status: 'answered' as const, 
            evidence: ['十分な長さの根拠テキスト'] // 12文字
          }
        ],
        questions: [
          { id: 'q1', content: '質問1', order: 1, projectId: 'test', createdAt: new Date() }
        ],
        transcript
      };

      const result = normalizeInterviewSummary(mockData);

      expect(result.items[0].status).toBe('answered');
      expect(result.metadata.downgradedCount).toBe(0);
    });
  });

  describe('NormalizationOK: 全角/半角・空白・句読点の違いのみ → 一致として承認', () => {
    it('全角半角の違いは正規化で吸収', () => {
      const transcript = '１２３ＡＢＣ　あいうえお、こんにちは。';
      const evidence = '123ABC あいうえお、こんにちは。';
      
      expect(validateEvidence(evidence, transcript)).toBe(true);
    });

    it('空白の違いは正規化で吸収', () => {
      const transcript = 'テキスト　　　に　空白が　　ある';
      const evidence = 'テキスト に 空白が ある';
      
      expect(validateEvidence(evidence, transcript)).toBe(true);
    });

    it('句読点の違いは正規化で吸収', () => {
      const transcript = 'こんにちは、元気ですか。はい、元気です。';
      const evidence = 'こんにちは，元気ですか．はい，元気です．';
      
      expect(validateEvidence(evidence, transcript)).toBe(true);
    });
  });

  describe('NoJSONGarbage: 前後テキスト混入 → 修復で復旧', () => {
    it('有効なJSON構造の検出', () => {
      const validResponse = {
        items: [
          { question: '質問1', answer: '回答1', status: 'answered', evidence: ['根拠1'] }
        ]
      };

      const schemaResult = validateInterviewSchema(validResponse, 1);
      expect(schemaResult.isValid).toBe(true);
    });

    it('無効な構造の検出', () => {
      const invalidResponse = {
        items: [
          { question: '質問1', answer: '回答1', status: 'answered' } // evidenceが欠如
        ]
      };

      const schemaResult = validateInterviewSchema(invalidResponse, 1);
      expect(schemaResult.isValid).toBe(false);
      expect(schemaResult.errors).toContain(expect.stringMatching(/evidence/));
    });
  });

  describe('テキスト正規化機能', () => {
    it('包括的な正規化処理', () => {
      const input = 'テスト　　　１２３ＡＢＣ、、こんにちは。。「引用」';
      const expected = 'テスト 123ABC、こんにちは。「引用」';
      
      expect(normalizeText(input)).toBe(expected);
    });

    it('Evidence品質分析', () => {
      const evidences = ['短い', '十分な長さのテキスト', '存在しない根拠'];
      const transcript = '十分な長さのテキストが含まれています。';

      const analysis = analyzeEvidenceQuality(evidences, transcript);

      expect(analysis.totalCount).toBe(3);
      expect(analysis.validCount).toBe(1);
      expect(analysis.tooShort).toBe(1);
      expect(analysis.notFound).toBe(1);
      expect(analysis.qualityScore).toBe(1/3);
    });
  });

  describe('統合シナリオ', () => {
    it('完全なワークフロー: 問題データ → 正規化 → 修復', () => {
      // 問題のあるデータ（回答はあるがevidenceが不正）
      const problematicData = {
        items: [
          { question: '創業について', answer: '2020年に起業しました', status: 'answered' as const, evidence: ['短い'] },
          { question: '事業について', answer: 'SaaS事業です', status: 'answered' as const, evidence: [] },
          { question: '余分な質問', answer: '余分', status: 'answered' as const, evidence: ['余分根拠'] }
        ],
        questions: [
          { id: 'q1', content: '創業について', order: 1, projectId: 'test', createdAt: new Date() },
          { id: 'q2', content: '事業について', order: 2, projectId: 'test', createdAt: new Date() }
        ],
        transcript: '2020年に起業しました。SaaS事業を展開しています。'
      };

      const result = normalizeInterviewSummary(problematicData);

      // 受け入れ基準チェック
      expect(result.items).toHaveLength(2); // ✅ 出力件数は常に質問数に一致
      expect(result.items[0].status).toBe('unanswered'); // ✅ evidenceが無効 → unanswered
      expect(result.items[1].status).toBe('unanswered'); // ✅ evidenceが空 → unanswered
      expect(result.metadata.downgradedCount).toBe(2); // ✅ 「回答しているのに未回答になる」が正しく防げている
    });
    
    it('[受け入れテスト] strictEvidence:false → 回答テキスト保持', () => {
      const testData = {
        items: [
          { question: '創業について', answer: '2020年に起業しました', status: 'answered' as const, evidence: [] },
          { question: '事業について', answer: 'SaaS事業です', status: 'answered' as const, evidence: ['短い'] }
        ],
        questions: [
          { id: 'q1', content: '創業について', order: 1, projectId: 'test', createdAt: new Date() },
          { id: 'q2', content: '事業について', order: 2, projectId: 'test', createdAt: new Date() }
        ],
        transcript: '何らかのトランスクリプト',
        strictEvidence: false
      };
      
      const result = normalizeInterviewSummary(testData);
      
      // 受け入れ基準：strictEvidence=false時は回答テキスト保持
      expect(result.items).toHaveLength(2);
      expect(result.items[0].status).toBe('answered'); // evidenceが空でもanswered保持
      expect(result.items[0].answer).toBe('2020年に起業しました'); // 回答テキスト保持
      expect(result.items[1].status).toBe('answered'); // 短いevidenceでもanswered保持  
      expect(result.items[1].answer).toBe('SaaS事業です'); // 回答テキスト保持
      expect(result.metadata.downgradedCount).toBe(0); // ダウンシフトなし
    });
  });
});

describe('スキーマバリデーション強化', () => {
  it('ビジネスロジック違反の検出', () => {
    const invalidData = {
      items: [
        { question: 'Q1', answer: 'answered but no evidence', status: 'answered', evidence: [] },
        { question: 'Q2', answer: 'not null', status: 'unanswered', evidence: ['some evidence'] }
      ]
    };

    const result = validateInterviewSchema(invalidData, 2);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(expect.stringMatching(/Q1.*answered項目にevidenceが不足/));
    expect(result.errors).toContain(expect.stringMatching(/Q2.*unanswered項目でanswerがnullではない/));
  });
});