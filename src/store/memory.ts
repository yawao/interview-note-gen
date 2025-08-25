interface ArticleData {
  markdown: string;
  json: any;
}

class MemoryArticleStore {
  private store: Map<string, ArticleData> = new Map();
  
  set(id: string, data: ArticleData): void {
    this.store.set(id, data);
  }
  
  get(id: string): ArticleData | undefined {
    return this.store.get(id);
  }
}

export const ArticleStore = new MemoryArticleStore();