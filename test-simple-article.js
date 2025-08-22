// より単純な記事生成テスト
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testSimpleArticle() {
  try {
    console.log('=== 単純な記事生成テスト開始 ===');
    
    const testData = fs.readFileSync('./test-long-answers.txt', 'utf-8');
    
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "あなたは記事ライターです。インタビュー内容をもとに、日本語でブログ記事を作成してください。H1タイトル、リード文、3-4個のH2セクション、まとめを含む完全な記事を作成してください。"
        },
        {
          role: "user",
          content: `以下のインタビュー内容をもとに、「スタートアップ資金調達の成功戦略」というテーマで記事を作成してください：

${testData}

記事は1500-2000文字程度で、読者に役立つ情報を提供してください。`
        }
      ],
      max_output_tokens: 12000,
    });

    console.log('\\n=== 応答詳細 ===');
    console.log('Status:', completion.status);
    console.log('Total tokens:', completion.usage?.total_tokens);
    console.log('Output tokens:', completion.usage?.output_tokens);
    console.log('Reasoning tokens:', completion.usage?.output_tokens_details?.reasoning_tokens);
    
    const article = completion.output_text || '';
    console.log('\\n記事文字数:', article.length);
    
    if (article && article.length > 100) {
      fs.writeFileSync('./test-simple-generated-article.md', article);
      console.log('✅ 記事保存成功');
      
      // 最初の500文字を表示
      console.log('\\n記事冒頭:');
      console.log(article.substring(0, 500) + '...');
      
      return { success: true, length: article.length };
    } else {
      console.log('生成された記事:', JSON.stringify(article));
      throw new Error('記事生成失敗');
    }
    
  } catch (error) {
    console.error('エラー:', error);
    throw error;
  }
}

testSimpleArticle().then(result => {
  console.log('\\n✅ テスト成功:', result);
}).catch(error => {
  console.error('❌ テスト失敗:', error.message);
  process.exit(1);
});