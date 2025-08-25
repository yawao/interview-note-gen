import { NextRequest, NextResponse } from 'next/server';
import { generateQueue } from '../queue';
import { GenerateJob } from '../types/pipeline';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, idempotencyKey } = body;
    
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { error: 'topic is required and must be a string' },
        { status: 400 }
      );
    }
    
    const key = idempotencyKey || randomBytes(16).toString('hex');
    
    const jobData: GenerateJob = {
      idempotencyKey: key,
      usecase: 'article',
      version: 'v1',
      inputs: { topic }
    };
    
    const job = await generateQueue.add('generate-article', jobData, {
      jobId: key,
      removeOnComplete: true,
      removeOnFail: false
    });
    
    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    console.error('Error in generate API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}