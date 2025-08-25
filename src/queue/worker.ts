import { Worker, Job } from 'bullmq';
import { GenerateJob, JobState, Stage } from '../types/pipeline';
import { renderArticle, ArticleJSON } from '../lib/renderArticle';
import { validateMarkdown } from '../lib/validate';
import { ArticleStore } from '../store/memory';

const connection = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) || 6379 : 6379,
};

async function processStage(job: Job<GenerateJob>, stage: Stage, state: JobState): Promise<JobState> {
  const { topic } = job.data.inputs;
  
  switch (stage) {
    case Stage.BRIEF:
      return { ...state, brief: `要約: ${topic}` };
      
    case Stage.OUTLINE:
      return { ...state, outline: ['背景', '事例', '示唆'] };
      
    case Stage.DRAFT_JSON:
      const mockJson: ArticleJSON = {
        intro: `${topic}について、この記事では詳しく解説していきます。`,
        background: `${topic}の背景には様々な課題があり、解決が求められています。`,
        cases: {
          text: `${topic}の具体的な事例を以下に示します。`,
          metrics: [
            { name: 'CVR', value: 3.2, unit: '%' },
            { name: 'Leads', value: 1500, unit: '件' }
          ]
        },
        insights: [
          `${topic}から得られる重要な示唆の一つ目`,
          `${topic}に関する二つ目の重要なポイント`,
          `${topic}における三つ目の戦略的視点`
        ],
        faq: [
          { q: `${topic}について詳しく知りたい`, a: '詳細な情報をご提供いたします' },
          { q: 'どのような効果が期待できますか？', a: '具体的な効果をお伝えします' }
        ],
        cta: `${topic}についてさらに詳しく知りたい方は、お気軽にお問い合わせください。`
      };
      return { ...state, draftJson: mockJson };
      
    case Stage.RENDER_MD:
      if (!state.draftJson) throw new Error('draftJson is required for RENDER_MD stage');
      const markdown = renderArticle(state.draftJson);
      return { ...state, markdown };
      
    case Stage.QC:
      if (!state.markdown) throw new Error('markdown is required for QC stage');
      const qc = validateMarkdown(state.markdown);
      if (!qc.ok) throw new Error(`QC failed: ${qc.errors?.join(', ')}`);
      return { ...state, qc };
      
    case Stage.PUBLISH:
      if (!state.markdown || !state.draftJson) throw new Error('markdown and draftJson are required for PUBLISH stage');
      ArticleStore.set(job.data.idempotencyKey, {
        markdown: state.markdown,
        json: state.draftJson
      });
      console.log(`Published article: ${job.data.idempotencyKey}`);
      return state;
      
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}

export const worker = new Worker<GenerateJob>(
  'generate',
  async (job: Job<GenerateJob>) => {
    let state: JobState = { attempts: 0 };
    const stages = [Stage.BRIEF, Stage.OUTLINE, Stage.DRAFT_JSON, Stage.RENDER_MD, Stage.QC, Stage.PUBLISH];
    
    for (const stage of stages) {
      state.attempts++;
      state = await processStage(job, stage, state);
    }
    
    return state;
  },
  {
    connection,
    concurrency: 1,
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 2,
    backoff: 'exponential'
  }
);