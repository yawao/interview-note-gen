export interface ArticleJSON {
  intro: string;
  background: string;
  cases: {
    text: string;
    metrics: Array<{
      name: 'CVR' | 'CAC' | 'LTV' | 'Retention' | 'Leads' | 'PV';
      value: number;
      unit: string;
    }>;
  };
  insights: string[];
  faq: Array<{
    q: string;
    a: string;
  }>;
  cta: string;
}

export function formatPercent(n: number): string {
  return `${n}%`;
}

export function formatYen(n: number): string {
  return `¥${n.toLocaleString()}`;
}

export function formatInt(n: number): string {
  return n.toLocaleString();
}

export function renderArticle(a: ArticleJSON): string {
  const sections: string[] = [];

  sections.push(`## 導入\n${a.intro}`);
  sections.push(`## 背景と課題\n${a.background}`);

  const metricsText = a.cases.metrics
    .map(m => `- ${m.name}: ${m.value}${m.unit}`)
    .join('\n');
  sections.push(`## 事例/分析\n${a.cases.text}\n\n${metricsText}`);

  const insightsText = a.insights
    .map(insight => `- ${insight}`)
    .join('\n');
  sections.push(`## 示唆\n${insightsText}`);

  const faqText = a.faq
    .map(item => `- **Q:** ${item.q}\n  - **A:** ${item.a}`)
    .join('\n');
  sections.push(`## FAQ\n${faqText}`);

  sections.push(`## CTA\n${a.cta}`);

  return sections.join('\n\n');
}