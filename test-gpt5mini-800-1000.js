// gpt-5-miniで800-1000文字回答テスト
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testGPT5Mini800to1000() {
  try {
    console.log('=== gpt-5-mini 800-1000文字回答テスト開始 ===');
    
    // 既存のテストデータを使用
    const testData = fs.readFileSync('./test-very-long-answers.txt', 'utf-8');
    console.log('テストデータ文字数:', testData.length);
    console.log('モデル: gpt-5-mini');
    
    console.log('\\n1. 単純プロンプトでの記事生成テスト...');
    
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "あなたはプロの記事ライターです。インタビュー内容をもとに、日本語でブログ記事を作成してください。記事は以下の構成で作成してください：\\n1. H1タイトル（魅力的で読者の関心を引く）\\n2. リード文（3-4行で記事の概要と読者メリット）\\n3. 3-5個のH2セクション（各500-700文字程度）\\n4. まとめ（H2セクション）\\n\\n記事は2500-3500文字程度で、読みやすく実用的な内容にしてください。"
        },
        {
          role: "user",
          content: `以下のインタビュー内容をもとに、「スタートアップ資金調達の成功戦略」というテーマでブログ記事を作成してください：

${testData}

各質問への回答が詳細で長いため、重要なポイントを整理して読者に価値のある記事にしてください。具体的な数字や事例を活用し、実践的なアドバイスを盛り込んでください。`
        }
      ],
      max_output_tokens: 16000,
    });

    console.log('\\n=== gpt-5-mini 応答詳細 ===');
    console.log('Status:', completion.status);
    console.log('Total tokens:', completion.usage?.total_tokens);
    console.log('Input tokens:', completion.usage?.input_tokens);
    console.log('Output tokens:', completion.usage?.output_tokens);
    console.log('Reasoning tokens:', completion.usage?.output_tokens_details?.reasoning_tokens || 0);
    
    const article = completion.output_text || '';
    console.log('\\n生成記事文字数:', article.length);
    
    if (article && article.length > 100) {
      fs.writeFileSync('./test-gpt5mini-800-1000-article.md', article);
      console.log('✅ 記事をtest-gpt5mini-800-1000-article.mdに保存');
      
      // 記事構造分析
      const h1Count = (article.match(/^# /gm) || []).length;
      const h2Count = (article.match(/^## /gm) || []).length;
      const h3Count = (article.match(/^### /gm) || []).length;
      const bulletCount = (article.match(/^[・\-\*]/gm) || []).length;
      const numberMatches = (article.match(/\\d+[%億万円年月日時間分週]/g) || []).length;
      
      // H1:, H2-形式もカウント
      const h1AltCount = (article.match(/H1:/g) || []).length;
      const h2AltCount = (article.match(/H2[-:]\\d*/g) || []).length;
      
      console.log('\\n📊 記事構造分析:');
      console.log('- H1見出し:', h1Count + h1AltCount);
      console.log('- H2見出し:', h2Count + h2AltCount);
      console.log('- H3見出し:', h3Count);
      console.log('- 箇条書き:', bulletCount);
      console.log('- 数字データ:', numberMatches, '個');
      
      // 品質評価
      const totalH1 = h1Count + h1AltCount;
      const totalH2 = h2Count + h2AltCount;
      const isHighQuality = totalH1 >= 1 && totalH2 >= 3 && article.length >= 2000;
      const hasRichContent = numberMatches > 5 && bulletCount > 0;
      
      console.log('\\n🎯 品質評価:');
      console.log('- 基本構造:', isHighQuality ? '✅ 合格' : '❌ 不十分');
      console.log('- 内容の充実度:', hasRichContent ? '✅ 豊富' : '❌ 不足');
      
      // 最初の1000文字を表示
      console.log('\\n📝 記事冒頭（1000文字）:');
      console.log(article.substring(0, 1000) + '...');
      
      // gpt-5-nanoとの比較
      let comparison = {};
      try {
        const nanoArticle = fs.readFileSync('./test-800-1000-generated-article.md', 'utf-8');
        comparison = {
          nano_length: nanoArticle.length,
          mini_length: article.length,
          length_ratio: (article.length / nanoArticle.length).toFixed(2)
        };
        console.log('\\n📊 gpt-5-nanoとの比較:');
        console.log(`- gpt-5-nano記事: ${comparison.nano_length}文字`);
        console.log(`- gpt-5-mini記事: ${comparison.mini_length}文字`);
        console.log(`- 長さ比率: ${comparison.length_ratio}倍`);
      } catch (e) {
        console.log('\\n📊 比較データなし（初回実行）');
      }
      
      return {
        success: true,
        model: 'gpt-5-mini',
        articleLength: article.length,
        structure: { 
          h1: totalH1, 
          h2: totalH2, 
          h3: h3Count, 
          bullets: bulletCount, 
          numbers: numberMatches 
        },
        quality: { isHighQuality, hasRichContent },
        tokenUsage: completion.usage,
        comparison
      };
    } else {
      console.log('生成された記事:', JSON.stringify(article));
      throw new Error('記事生成失敗');
    }
    
  } catch (error) {
    console.error('❌ gpt-5-miniテストエラー:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      status: error?.status
    });
    throw error;
  }
}

// 複雑プロンプトテスト
async function testComplexPromptGPT5Mini() {
  try {
    console.log('\\n\\n=== gpt-5-mini 複雑プロンプトテスト ===');
    
    const testData = fs.readFileSync('./test-very-long-answers.txt', 'utf-8');
    
    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: `あなたはプロの編集者・ライターです。以下の詳細なQ&Aを素材として、読者に価値を提供するブログ向けのインタビュー記事を作成してください。

## 記事要件
1. **記事タイトル**: H1形式（#）で30-40文字、読者の興味を引くもの
2. **リード文**: 3-4行でインタビューの概要と読者メリットを提示
3. **本文構成**: 3-5個のH2見出しで構造化
4. **各セクション**: 400-600字程度で、具体例・データ・実践的示唆を含む
5. **まとめ**: 要点整理と読者への行動喚起
6. **文体**: です・ます調、専門用語は分かりやすく説明

## 注意点
- 長い回答から要点を抽出し、読みやすく再構成する
- 数字・データ・具体例を積極的に活用する
- 読者が実際に活用できる実践的な内容にする
- 記事全体で2500-3500文字程度に仕上げる`
        },
        {
          role: "user",
          content: `テーマ: スタートアップ資金調達の成功戦略
インタビュイー: tech企業創業者（匿名）

以下の詳細なインタビュー内容をもとに、要件に従って記事を作成してください：

${testData}

長い回答が含まれていますが、読者にとって価値のあるポイントを抽出し、構造化された記事にしてください。`
        }
      ],
      max_output_tokens: 16000,
    });

    console.log('gpt-5-mini複雑プロンプト結果:');
    console.log('Status:', completion.status);
    console.log('記事文字数:', completion.output_text?.length || 0);
    console.log('Total tokens:', completion.usage?.total_tokens);
    
    if (completion.output_text && completion.output_text.length > 100) {
      fs.writeFileSync('./test-gpt5mini-complex-article.md', completion.output_text);
      console.log('✅ 複雑プロンプト記事を test-gpt5mini-complex-article.md に保存');
      return { success: true, length: completion.output_text.length, usage: completion.usage };
    }
    
    return { success: false, length: 0 };
    
  } catch (error) {
    console.error('gpt-5-mini複雑プロンプトテスト失敗:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行部分
async function runGPT5MiniTests() {
  console.log('🔍 gpt-5-mini 800-1000文字回答での記事生成システムテスト');
  
  try {
    // テスト1: 単純プロンプト
    const result1 = await testGPT5Mini800to1000();
    
    // テスト2: 複雑プロンプト  
    const result2 = await testComplexPromptGPT5Mini();
    
    console.log('\\n\\n🎉 gpt-5-mini全テスト完了');
    console.log('単純プロンプト:', result1.success ? '✅ 成功' : '❌ 失敗');
    console.log('複雑プロンプト:', result2.success ? '✅ 成功' : '❌ 失敗');
    
    if (result1.success && result1.quality?.isHighQuality) {
      console.log('\\n✅ 結論: gpt-5-miniで800-1000文字の長文回答からの記事生成は正常動作');
      console.log(`📊 生成記事: ${result1.articleLength}文字`);
      console.log(`📊 トークン使用: ${result1.tokenUsage?.total_tokens}トークン`);
      console.log(`📊 品質スコア: 構造${result1.structure.h2}H2, データ${result1.structure.numbers}個`);
    } else {
      console.log('\\n⚠️ 一部制限あり: 基本機能は動作するが品質改善の余地がある');
    }
    
    // 最終結果
    const overallSuccess = result1.success && result2.success;
    console.log('\\n🎯 最終評価:', overallSuccess ? 'gpt-5-mini完全対応' : '部分的対応');
    
    return { success: overallSuccess, details: { simple: result1, complex: result2 } };
    
  } catch (error) {
    console.error('❌ gpt-5-miniテスト実行エラー:', error.message);
    process.exit(1);
  }
}

runGPT5MiniTests();