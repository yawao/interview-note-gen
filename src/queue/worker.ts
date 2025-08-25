import { Worker, Job } from 'bullmq';
import { GenerateJob, JobState, Stage } from '../types/pipeline';
import { renderArticle } from '../lib/renderArticle';
import { validateArticleJson, validateMarkdown } from '../lib/validate';
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
      const mockJson = {
        intro: `${topic}について、この記事では詳しく解説していきます。具体的な手法と実践的なアプローチを紹介します。`,
        background: `${topic}の背景には様々な課題があり、企業において解決が求められています。従来の手法では限界があり、新しいアプローチが必要です。`,
        cases: {
          text: `${topic}の具体的な事例として、実際の導入企業での成果を紹介します。数値データとともに詳細を解説します。`,
          metrics: [
            { name: 'CVR', value: 3.2, unit: '%' },
            { name: 'Leads', value: 1500, unit: '件' }
          ]
        },
        insights: [
          `${topic}から得られる重要な示唆として、戦略的アプローチの重要性が挙げられます`,
          `${topic}に関する二つ目のポイントは、継続的な改善プロセスの必要性です`,
          `${topic}における三つ目の視点として、チーム全体での取り組みが成功の鍵となります`
        ],
        faq: [
          { q: `${topic}について詳しく知りたいのですが、どこから始めればよいですか？`, a: '基本的な概念から学習を始め、段階的に実践的なスキルを身につけることをお勧めします。' },
          { q: 'どのような効果が期待できますか？', a: '適切に実施することで、効率性の向上と品質改善の両方を実現できます。' }
        ],
        cta: `${topic}についてさらに詳しく知りたい方は、専門家による無料相談をご利用ください。お気軽にお問い合わせください。`
      };
      return { ...state, draftJson: mockJson };
      
    case Stage.RENDER_MD:
      if (!state.draftJson) throw new Error('draftJson is required for RENDER_MD stage');
      
      const jsonValidation = validateArticleJson(state.draftJson);
      if (!jsonValidation.ok) {
        throw new Error(`JSON validation failed: ${jsonValidation.errors?.join(', ')}`);
      }
      
      const markdown = renderArticle(state.draftJson);
      return { ...state, markdown };
      
    case Stage.QC:
      if (!state.markdown) throw new Error('markdown is required for QC stage');
      
      const markdownValidation = validateMarkdown(state.markdown);
      if (!markdownValidation.ok) {
        throw new Error(`Markdown validation failed: ${markdownValidation.errors?.join(', ')}`);
      }
      
      return { ...state, qc: { ok: true } };
      
    case Stage.PUBLISH:
      if (!state.markdown || !state.draftJson) {
        throw new Error('markdown and draftJson are required for PUBLISH stage');
      }
      
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
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
);