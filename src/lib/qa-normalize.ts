// Q/A正規化ユーティリティ
// 配列を真実のソースとし、最大7件制限＋未回答補完禁止

export type QAInput = {
  questions: string[];
  answers: string[];               // ユーザ回答。空は空のまま残す
  followUps?: string[][];          // 各Qの追問群
  metadata?: Record<string, any>;  // その他のメタデータ
};

export type QAOutput = {
  questions: string[];
  answers: string[];
  followUps: string[][];
  displayIndex: number[];          // [1..k] 表示用インデックス
  metadata?: Record<string, any>;
};

export type NormalizeOptions = {
  maxQuestions: number;
  maxFollowUpsPerQ: number;
  allowEmptyAnswers: boolean;      // 空回答を許可するか
};

/**
 * Q/A配列の正規化
 * - 最大件数制限（デフォルト7件）
 * - 未回答は空のまま保持（自動補完禁止）
 * - follow-up数制限
 * - displayIndex生成（UI表示用）
 */
export function normalizeInterview(
  input: QAInput,
  options: Partial<NormalizeOptions> = {}
): QAOutput {
  const opt: NormalizeOptions = {
    maxQuestions: 7,
    maxFollowUpsPerQ: 2,
    allowEmptyAnswers: true,
    ...options
  };

  console.log('🔧 Q/A正規化開始')
  console.log(`- 入力: Q=${input.questions?.length || 0}, A=${input.answers?.length || 0}`)
  
  // 実際の配列長を取得（最大値ベース）
  const actualLength = Math.max(
    input.questions?.length || 0,
    input.answers?.length || 0,
    input.followUps?.length || 0
  );
  
  // 制限適用
  const targetLength = Math.min(opt.maxQuestions, actualLength);
  
  if (targetLength === 0) {
    console.log('⚠️ 質問・回答がすべて空です')
    return {
      questions: [],
      answers: [],
      followUps: [],
      displayIndex: [],
      metadata: input.metadata
    };
  }
  
  // 配列をスライス（最大件数まで）
  const questions = (input.questions || []).slice(0, targetLength);
  const answers = (input.answers || []).slice(0, targetLength);
  const followUps = (input.followUps || []).slice(0, targetLength);
  
  // 長さ調整（足りない分を安全側で埋める）
  while (questions.length < targetLength) {
    questions.push(''); // 空の質問（UIで「設問未設定」表示）
  }
  
  while (answers.length < targetLength) {
    answers.push(''); // 空の回答（自動補完禁止）
  }
  
  while (followUps.length < targetLength) {
    followUps.push([]);
  }
  
  // follow-up数制限
  const normalizedFollowUps = followUps.map(fuArray => 
    (fuArray || []).slice(0, opt.maxFollowUpsPerQ)
  );
  
  // displayIndex生成（1ベース）
  const displayIndex = Array.from({ length: targetLength }, (_, i) => i + 1);
  
  console.log(`✅ 正規化完了: ${targetLength}件 (最大${opt.maxQuestions})`)
  console.log(`- 空質問: ${questions.filter(q => !q.trim()).length}件`)
  console.log(`- 空回答: ${answers.filter(a => !a.trim()).length}件`)
  
  return {
    questions,
    answers,
    followUps: normalizedFollowUps,
    displayIndex,
    metadata: input.metadata
  };
}

/**
 * Q/A数の検証
 * - 5-7件の範囲チェック
 * - 空の扱いの妥当性チェック
 */
export function validateQACount(
  input: QAInput,
  requirements: { minQuestions?: number; maxQuestions?: number } = {}
): { isValid: boolean; violations: string[]; recommendations: string[] } {
  const { minQuestions = 5, maxQuestions = 7 } = requirements;
  const violations: string[] = [];
  const recommendations: string[] = [];
  
  const questionCount = input.questions?.length || 0;
  const answerCount = input.answers?.length || 0;
  
  // 基本的な件数チェック
  if (questionCount < minQuestions) {
    violations.push(`質問数が不足: ${questionCount}件 (最小${minQuestions}件)`)
    recommendations.push('質問を追加生成してください')
  }
  
  if (questionCount > maxQuestions) {
    violations.push(`質問数が上限超過: ${questionCount}件 (最大${maxQuestions}件)`)
    recommendations.push(`${maxQuestions}件に削減されます`)
  }
  
  // 回答との同期チェック
  if (Math.abs(questionCount - answerCount) > 2) {
    violations.push(`質問と回答の件数に大きな差: Q=${questionCount}, A=${answerCount}`)
    recommendations.push('正規化により同じ長さに調整されます')
  }
  
  // 空の質問・回答の状況
  const emptyQuestions = (input.questions || []).filter(q => !q.trim()).length;
  const emptyAnswers = (input.answers || []).filter(a => !a.trim()).length;
  
  if (emptyQuestions > 0) {
    recommendations.push(`空の質問: ${emptyQuestions}件 → UI側で「設問未設定」表示`)
  }
  
  if (emptyAnswers > 0) {
    recommendations.push(`未回答: ${emptyAnswers}件 → 空のまま保持（補完なし）`)
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    recommendations
  };
}

/**
 * Q/Aデータのサニタイズ
 * - 危険な文字列の除去
 * - プロンプトインジェクション対策
 */
export function sanitizeQAData(input: QAInput): QAInput {
  const sanitizeString = (str: string): string => {
    if (!str) return str;
    
    return str
      .replace(/Q\d+\s*[:：]/g, '')           // Q1: Q2: など
      .replace(/質問内容が見つかりません/g, '')    // プレースホルダ文言
      .replace(/設問\d+/g, '')               // 設問1 設問2 など
      .replace(/【.*?】/g, '')               // 【見出し】形式
      .trim();
  };
  
  const sanitizeArray = (arr: string[]): string[] => {
    return arr.map(sanitizeString);
  };
  
  return {
    questions: sanitizeArray(input.questions || []),
    answers: sanitizeArray(input.answers || []),
    followUps: (input.followUps || []).map(fuArray => sanitizeArray(fuArray)),
    metadata: input.metadata
  };
}

/**
 * デバッグ用：Q/A構造の分析
 */
export function analyzeQAStructure(input: QAInput): {
  summary: string;
  details: {
    questionCount: number;
    answerCount: number;
    followUpCount: number;
    emptyQuestions: number;
    emptyAnswers: number;
    averageQuestionLength: number;
    averageAnswerLength: number;
  };
} {
  const questions = input.questions || [];
  const answers = input.answers || [];
  const followUps = input.followUps || [];
  
  const emptyQuestions = questions.filter(q => !q.trim()).length;
  const emptyAnswers = answers.filter(a => !a.trim()).length;
  
  const avgQuestionLength = questions.length > 0 
    ? Math.round(questions.reduce((sum, q) => sum + q.length, 0) / questions.length)
    : 0;
    
  const avgAnswerLength = answers.length > 0
    ? Math.round(answers.reduce((sum, a) => sum + a.length, 0) / answers.length)
    : 0;
  
  const totalFollowUps = followUps.reduce((sum, fuArray) => sum + (fuArray?.length || 0), 0);
  
  const details = {
    questionCount: questions.length,
    answerCount: answers.length,
    followUpCount: totalFollowUps,
    emptyQuestions,
    emptyAnswers,
    averageQuestionLength: avgQuestionLength,
    averageAnswerLength: avgAnswerLength
  };
  
  const summary = `Q/A構造: ${details.questionCount}質問, ${details.answerCount}回答, ${details.followUpCount}追問 | 空Q=${details.emptyQuestions}, 空A=${details.emptyAnswers}`;
  
  return { summary, details };
}