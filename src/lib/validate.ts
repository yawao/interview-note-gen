import Ajv from 'ajv';
import { structuredArticleSchema } from '../types/article';
import { validateRenderedArticle } from './article-validation';

const ajv = new Ajv();
const validate = ajv.compile(structuredArticleSchema);

export function validateArticleJson(data: any): { ok: boolean; errors?: string[] } {
  const valid = validate(data);
  if (valid) {
    return { ok: true };
  }
  
  const errors = validate.errors?.map(err => {
    const path = err.instancePath ? err.instancePath.replace(/^\//, '') : 'root';
    return `${path}: ${err.message}`;
  }) || ['Validation failed'];
  
  return { ok: false, errors };
}

export function validateMarkdown(md: string): { ok: boolean; errors?: string[] } {
  const result = validateRenderedArticle(md);
  
  if (result.valid) {
    return { ok: true };
  }
  
  return { ok: false, errors: result.reasons || ['Validation failed'] };
}