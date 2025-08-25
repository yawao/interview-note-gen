import Ajv from 'ajv';
import schema from '../contracts/article.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(schema);

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
  const errors: string[] = [];
  
  const h2Matches = md.match(/^## .+$/gm);
  const expectedH2s = ['## 導入', '## 背景と課題', '## 事例/分析', '## 示唆', '## FAQ', '## CTA'];
  
  if (!h2Matches || h2Matches.length !== 6) {
    errors.push(`H2見出しが${h2Matches?.length || 0}個です。ちょうど6個必要です`);
  } else {
    for (let i = 0; i < 6; i++) {
      if (h2Matches[i] !== expectedH2s[i]) {
        errors.push(`H2見出しの順序が不正です。${i + 1}番目は「${expectedH2s[i]}」である必要があります`);
        break;
      }
    }
  }
  
  if (md.includes('# ')) {
    errors.push('H1見出し(# )が含まれています');
  }
  
  if (md.includes('### ')) {
    errors.push('H3見出し(### )が含まれています');
  }
  
  const numberedListMatch = md.match(/^\d+\. /gm);
  if (numberedListMatch) {
    errors.push('番号付きリストが含まれています');
  }
  
  if (md.match(/^##\s*$/gm)) {
    errors.push('タイトルが欠落した見出しがあります');
  }
  
  if (md.includes('％')) {
    errors.push('全角パーセント記号(％)が含まれています');
  }
  
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}