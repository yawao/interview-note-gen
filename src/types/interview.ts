// 新規インタビュー処理型定義
// 構造化入力による質問数制御とJSON入出力システム

export type Question = { 
  id: string; 
  order: number; 
  text: string;
};

export type Answer = { 
  questionId: string; 
  text: string; 
  hasEvidence: boolean;
};

export type InterviewPayload = { 
  questions: Question[]; 
  answers: Answer[]; 
  context?: string; // 補足参照用（任意）。質問生成や件数には使わない
};

export type InterviewBlock = {
  order: number;
  question: string;
  body: string;
};

export type InterviewArticle = {
  blocks: InterviewBlock[];
};