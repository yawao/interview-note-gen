# AI Interviewer SaaS

A minimal SaaS application that transforms interview audio into structured articles using OpenAI's GPT-4o and Whisper APIs.

## Features

- **Interview Setup**: Create projects and generate AI-powered questions
- **Audio Recording**: Browser-based recording with MediaRecorder API
- **Transcription**: Automatic speech-to-text using OpenAI Whisper
- **Structured Interview Extraction**: Evidence-based Q&A analysis with root cause validation
- **AI Analysis**: Intelligent summarization with GPT-5-mini
- **Article Generation**: Automated Markdown article creation with multiple formats
- **Export**: Download articles in Markdown or plain text format

### 🆕 Enhanced Interview Processing

**Evidence-Gated Extraction**: The system now enforces strict evidence requirements for interview answers:

- **No Auto-fill**: Unanswered questions remain as `null` instead of generating speculative content
- **Evidence Validation**: All answered items must include direct quotes from the transcript
- **Fixed Output Count**: Interview items are strictly limited to the exact number of questions asked
- **Automatic Validation**: Multi-layer schema validation with auto-repair and defensive normalization

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (development) / Supabase Postgres (production)
- **ORM**: Prisma
- **AI**: OpenAI GPT-4o & Whisper APIs
- **Deployment**: Vercel

## Setup Instructions

### 1. Environment Variables

Copy the environment template:
```bash
cp .env.local.example .env.local
```

Add your OpenAI API key:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Database Setup

Generate Prisma client and run migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Tests

**Unit Tests** (Interview Validation):
```bash
npm test -- src/lib/__tests__/interview-validation.test.ts
```

**Integration Tests** (with actual LLM calls):
```bash
OPENAI_API_KEY=$OPENAI_API_KEY npx tsx test-interview-extraction.js
```

**End-to-End Tests**:
```bash
# Ensure dev server is running first
npm run dev

# In another terminal:
OPENAI_API_KEY=$OPENAI_API_KEY npx tsx test-e2e-complete.js
```

## Usage Workflow

1. **Setup**: Create a new interview project with theme and interviewee info
2. **Questions**: AI generates relevant interview questions
3. **Record**: Capture audio directly in the browser
4. **Transcribe**: Audio is automatically transcribed using Whisper
5. **Analyze**: GPT-4o creates a structured summary with key insights
6. **Draft**: Generate a complete article draft in Markdown format
7. **Export**: Download the final article as Markdown or plain text

## API Endpoints

- `POST /api/projects` - Create new interview project
- `POST /api/questions` - Generate AI questions (5-7 questions max)
- `POST /api/transcribe` - Transcribe audio with Whisper
- `POST /api/summarize` - Create structured interview extraction with evidence validation
- `POST /api/draft` - Generate article draft
- `GET /api/download/[id]` - Download article

### Enhanced Summarize API Response

The `/api/summarize` endpoint now returns structured data:

```json
{
  "id": "summary_id",
  "content": "Legacy markdown content for UI compatibility",
  "structured": {
    "items": [
      {
        "question": "質問内容",
        "answer": "回答内容 or null",
        "status": "answered" | "unanswered", 
        "evidence": ["直接引用1", "直接引用2"]
      }
    ]
  },
  "metadata": {
    "success": true,
    "validationPassed": true,
    "repairAttempted": false
  },
  "stats": {
    "totalQuestions": 5,
    "answeredCount": 3,
    "unansweredCount": 2,
    "evidenceCount": 8
  }
}
```

### Configuration Options

```typescript
interface InterviewExtractionOptions {
  strict_no_autofill: boolean    // Default: true
  exact_length_output: boolean   // Default: true  
  unanswered_token: string       // Default: "未回答"
}
```

## Database Schema

- **Projects**: Interview metadata and settings
- **Questions**: AI-generated interview questions
- **Transcriptions**: Audio transcripts from Whisper
- **Summaries**: Structured analysis from GPT-4o
- **Articles**: Final Markdown article drafts

## Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Production Database

For production, replace SQLite with Supabase Postgres:

```env
DATABASE_URL=your_supabase_database_url
SUPABASE_URL=your_supabase_url  
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## License

MIT License