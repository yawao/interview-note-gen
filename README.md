# AI Interviewer SaaS

A minimal SaaS application that transforms interview audio into structured articles using OpenAI's GPT-4o and Whisper APIs.

## Features

- **Interview Setup**: Create projects and generate AI-powered questions
- **Audio Recording**: Browser-based recording with MediaRecorder API
- **Transcription**: Automatic speech-to-text using OpenAI Whisper
- **AI Analysis**: Intelligent summarization with GPT-4o
- **Article Generation**: Automated Markdown article creation
- **Export**: Download articles in Markdown or plain text format

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
- `POST /api/questions` - Generate AI questions
- `POST /api/transcribe` - Transcribe audio with Whisper
- `POST /api/summarize` - Create AI summary
- `POST /api/draft` - Generate article draft
- `GET /api/download/[id]` - Download article

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