export type GenerateJob = {
  idempotencyKey: string;
  usecase: 'article';
  version: 'v1';
  inputs: {
    topic: string;
  };
};

export enum Stage {
  BRIEF,
  OUTLINE,
  DRAFT_JSON,
  RENDER_MD,
  QC,
  PUBLISH
}

export type JobState = {
  brief?: string;
  outline?: string[];
  draftJson?: any;
  markdown?: string;
  qc?: {
    ok: boolean;
    errors?: string[];
  };
  attempts: number;
};