// 記事生成テスト
import { generateOutlineAndMeta, generateArticleDraft } from './src/lib/openai.ts';
import fs from 'fs';

async function testArticleGeneration() {
  try {
    console.log('=== 記事生成テスト開始 ===');
    
    // 長文テスト用データを読み込み
    const testData = fs.readFileSync('./test-long-answers.txt', 'utf-8');
    const theme = 'スタートアップ資金調達の成功戦略';
    const interviewee = 'tech企業創業者（匿名）';
    
    console.log('1. アウトライン生成テスト...');
    const outlineResult = await generateOutlineAndMeta(
      'BLOG_POST',
      theme,
      interviewee,
      testData,
      'ja',
      'Professional'
    );
    
    console.log('✅ アウトライン生成成功');
    console.log('アウトライン項目数:', outlineResult.outline.length);
    console.log('メタデータ:', JSON.stringify(outlineResult.meta, null, 2));
    
    console.log('\\n2. 記事ドラフト生成テスト...');
    const articleDraft = await generateArticleDraft(
      theme,
      interviewee,
      'スタートアップの資金調達について詳細なインタビューを実施',
      testData
    );
    
    console.log('✅ 記事生成成功');
    console.log('記事文字数:', articleDraft.length);
    
    // 結果をファイルに保存
    const result = {
      theme,
      interviewee,
      outline: outlineResult.outline,
      meta: outlineResult.meta,
      article: articleDraft,
      stats: {
        outlineItems: outlineResult.outline.length,
        articleLength: articleDraft.length,
        testDataLength: testData.length
      }
    };
    
    fs.writeFileSync('./test-article-result.json', JSON.stringify(result, null, 2));
    console.log('\\n✅ テスト結果をtest-article-result.jsonに保存しました');
    
    // 記事をMarkdownファイルとしても保存
    fs.writeFileSync('./test-generated-article.md', articleDraft);
    console.log('✅ 生成記事をtest-generated-article.mdに保存しました');
    
    return result;
  } catch (error) {
    console.error('❌ 記事生成テストエラー:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    throw error;
  }
}

export default testArticleGeneration;