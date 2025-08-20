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