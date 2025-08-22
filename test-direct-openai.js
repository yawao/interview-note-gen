// OpenAI関数直接テスト
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testDirectOpenAI() {
  try {
    console.log('=== OpenAI Responses API 直接テスト開始 ===');
    
    const testData = fs.readFileSync('./test-long-answers.txt', 'utf-8');
    console.log('テストデータ文字数:', testData.length);
    
    // 1. 記事ドラフト生成テスト
    console.log('\\n1. 記事ドラフト生成テスト...');
    
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: `あなたはプロの編集者・ライターです。以下の Q&A を素材として、PHASE0 品質基準を満たすブログ向けのインタビュー記事を作成してください。

# PHASE0 品質基準（必須）
**各H2セクションは以下を全て含むこと：**
1. **数字・データ** - 3個以上の具体的な数値（年数、金額、パーセント、期間など）
2. **固有名詞** - 2個以上の具体名（企業名、サービス名、技術名、地名など）
3. **箇条書き** - 必ず1つ以上の「・」「-」「*」による箇条書きリスト
4. **アクション語彙** - 行動、次の一手、チェックリスト、やってみる、ステップ、実践のいずれかを含む

# 出力要件
1. **記事タイトル**  
   - H1形式（# ）で開始し、30〜40文字で読者の興味を引くもの
2. **リード文**  
   - 3〜4行でインタビューの概要と読者メリットを提示
3. **本文構成**  
   - 3〜5個のH2見出しを **インタビュー内容に合わせて自動設計**
   - 各H2セクションは400〜600字で、上記PHASE0基準を必ず満たす
   - 回答を「」で短く引用しつつ、具体例・補足解説・実践的示唆を加える
4. **FAQ**  
   - H2「FAQ」として3個以上のH3質問を含める
5. **CTA**  
   - H2「CTA」または「次のアクション」で読者への行動喚起
6. **文体**  
   - です・ます調。専門用語には簡潔な補足を入れる

# 注意事項
- 回答者の個人情報は創作しない  
- Q&Aを単に羅列しない（必ず記事化する）
- 各セクションでPHASE0基準未達の場合は具体例を追補する
- 曖昧な表現より具体的データ・事例を優先する`
        },
        {
          role: "user",
          content: `# インタビュー情報
テーマ: スタートアップ資金調達の成功戦略
インタビュイー: tech企業創業者（匿名）

# Q&A素材
${testData}

# 要約情報（参考）
スタートアップの資金調達戦略について詳細なインタビューを実施

上記のQ&Aを素材として、指定された要件に従ってブログ向けのインタビュー記事を作成してください。記事タイトルから始めて、リード文、H2見出しによる本文構成、まとめまで含めた完全な記事を作成してください。`
        }
      ],
      max_output_tokens: 8192,
    });

    console.log('\\n=== OpenAI応答詳細 ===');
    console.log('Status:', completion.status);
    console.log('Model:', completion.model);
    console.log('Total tokens:', completion.usage?.total_tokens);
    console.log('Input tokens:', completion.usage?.input_tokens);
    console.log('Output tokens:', completion.usage?.output_tokens);
    console.log('Reasoning tokens:', completion.usage?.output_tokens_details?.reasoning_tokens);
    
    const article = completion.output_text || '';
    console.log('\\n✅ 記事生成成功');
    console.log('生成記事文字数:', article.length);
    
    if (article && article.length > 0) {
      fs.writeFileSync('./test-generated-long-article.md', article);
      console.log('✅ 生成記事をtest-generated-long-article.mdに保存');
      
      // 記事の構造チェック
      const h1Count = (article.match(/^# /gm) || []).length;
      const h2Count = (article.match(/^## /gm) || []).length;
      const h3Count = (article.match(/^### /gm) || []).length;
      const bulletCount = (article.match(/^[・\-\*]/gm) || []).length;
      
      console.log('\\n📊 記事構造分析:');
      console.log('- H1見出し:', h1Count);
      console.log('- H2見出し:', h2Count);
      console.log('- H3見出し:', h3Count);
      console.log('- 箇条書き:', bulletCount);
      
      return {
        success: true,
        articleLength: article.length,
        structure: { h1Count, h2Count, h3Count, bulletCount },
        tokenUsage: completion.usage
      };
    } else {
      throw new Error('生成された記事が空です');
    }
    
  } catch (error) {
    console.error('❌ OpenAIテストエラー:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      status: error?.status
    });
    throw error;
  }
}

testDirectOpenAI().then(result => {
  console.log('\\n=== テスト完了 ===');
  console.log('成功: 600-800文字の長文回答で記事生成が正常動作');
  console.log('結果:', result);
}).catch(error => {
  console.error('テスト失敗:', error.message);
  process.exit(1);
});