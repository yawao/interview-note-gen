export interface Project {
  id: string
  title: string
  description?: string
  theme: string
  interviewee: string
  createdAt: Date
  updatedAt: Date
  questions: Question[]
  transcriptions: Transcription[]
  summaries: Summary[]
  articles: Article[]
}

export interface Question {
  id: string
  content: string
  order: number
  projectId: string
  createdAt: Date
}

export interface Transcription {
  id: string
  audioUrl: string
  text: string
  projectId: string
  createdAt: Date
}

export interface Summary {
  id: string
  content: string
  projectId: string
  createdAt: Date
}

// 新しい構造化インタビュー項目の型定義
export type InterviewItemStatus = 'answered' | 'unanswered'

export interface InterviewItem {
  question: string
  answer: string | null
  status: InterviewItemStatus
  evidence: string[]
}

export interface StructuredInterviewSummary {
  items: InterviewItem[]
}

// 設定オプション
export interface InterviewExtractionOptions {
  strict_no_autofill: boolean
  exact_length_output: boolean
  unanswered_token: string
  strictEvidence?: boolean // evidence必須チェックのトグル（デフォルト：true）
}

export type ArticleType = 'BLOG_POST' | 'HOW_TO_GUIDE';

export interface ArticleCommon {
  id: string;
  projectId: string;
  articleType: ArticleType;
  language: 'ja' | 'en';
  title: string;
  slug?: string;
  tone?: string;
  status: 'DRAFT' | 'READY' | 'PUBLISHED';
  createdAt: Date;
  updatedAt: Date;
}

export interface OutlineSection {
  id: string;
  order: number;
  heading: string;
  sectionType?: string;
  contentMd?: string;
  checklist?: string[];
}

export interface BlogMeta {
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  thesis?: string;
  keyPoints?: string[];
  faq?: { q: string; a: string }[];
  cta?: string;
}

export interface HowToStep {
  order: number;
  goal: string;
  action: string;
  validation?: string;
  warnings?: string[];
  notes?: string[];
}

export interface HowToMeta {
  targetPersona?: string;
  prerequisites?: string[];
  materials?: string[];
  timeRequired?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  steps: HowToStep[];
  troubleshooting?: { problem: string; fix: string }[];
  faq?: { q: string; a: string }[];
  cta?: string;
}

export interface ArticleDocument extends ArticleCommon {
  outline: OutlineSection[];
  meta: BlogMeta | HowToMeta;
}

export interface Article {
  id: string
  title: string
  content: string
  format: string
  projectId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateProjectData {
  title: string
  description?: string
  theme: string
  interviewee: string
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioBlob?: Blob
}

export const BLOG_OUTLINE_SKELETON: OutlineSection[] = [
  { id: 'intro', order: 1, heading: '導入', sectionType: 'intro' },
  { id: 'background', order: 2, heading: '背景と課題', sectionType: 'background' },
  { id: 'h2-1', order: 3, heading: '主要トピック1', sectionType: 'section' },
  { id: 'h2-2', order: 4, heading: '主要トピック2', sectionType: 'section' },
  { id: 'h2-3', order: 5, heading: '主要トピック3', sectionType: 'section' },
  { id: 'summary', order: 6, heading: 'まとめ', sectionType: 'summary' },
  { id: 'faq', order: 7, heading: 'FAQ', sectionType: 'faq' },
  { id: 'cta', order: 8, heading: 'CTA', sectionType: 'cta' }
];

export const HOWTO_OUTLINE_SKELETON: OutlineSection[] = [
  { id: 'intro', order: 1, heading: 'このガイドでできること', sectionType: 'intro' },
  { id: 'prereq', order: 2, heading: '前提条件と必要なもの', sectionType: 'prerequisites' },
  { id: 'steps', order: 3, heading: '手順', sectionType: 'steps' },
  { id: 'troubleshooting', order: 4, heading: 'トラブルシュート', sectionType: 'troubleshooting' },
  { id: 'faq', order: 5, heading: 'FAQ', sectionType: 'faq' },
  { id: 'cta', order: 6, heading: '次のアクション', sectionType: 'cta' }
];

// 新しいDraft画面用の型定義
export interface ComposeArticleRequest {
  questions: Array<{ id: string; text: string }>;
  answers: Array<{ qid: string; text: string }>;
  notes?: Array<{ id: string; text: string }>;
  options?: {
    normalize?: boolean;
    max_sections?: number;
  };
}

export interface ArticleOutlineSection {
  id: string;
  title: string;
}

export interface ArticleDraftSection {
  section_id: string;
  html: string;
  sources: string[];
  confidence: number;
}

export interface ComposeArticleResponse {
  outline: ArticleOutlineSection[];
  draft: ArticleDraftSection[];
  coverage: Record<string, number>;
}