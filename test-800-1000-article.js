// 800-1000文字回答での記事生成テスト
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function test800to1000CharArticle() {
  try {
    console.log('=== 800-1000文字回答記事生成テスト開始 ===');
    
    const testData = fs.readFileSync('./test-very-long-answers.txt', 'utf-8');
    console.log('テストデータ文字数:', testData.length);
    console.log('（各回答は800-1000文字程度）');
    
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

    console.log('\\n=== 応答詳細 ===');
    console.log('Status:', completion.status);
    console.log('Total tokens:', completion.usage?.total_tokens);
    console.log('Input tokens:', completion.usage?.input_tokens);
    console.log('Output tokens:', completion.usage?.output_tokens);
    console.log('Reasoning tokens:', completion.usage?.output_tokens_details?.reasoning_tokens);
    
    const article = completion.output_text || '';
    console.log('\\n生成記事文字数:', article.length);
    
    if (article && article.length > 100) {
      fs.writeFileSync('./test-800-1000-generated-article.md', article);
      console.log('✅ 記事をtest-800-1000-generated-article.mdに保存');
      
      // 記事構造分析
      const h1Count = (article.match(/^# /gm) || []).length;
      const h2Count = (article.match(/^## /gm) || []).length;
      const h3Count = (article.match(/^### /gm) || []).length;
      const bulletCount = (article.match(/^[・\-\*]/gm) || []).length;
      const numberMatches = (article.match(/\d+[%億万円年月日時間分週]/g) || []).length;
      
      console.log('\\n📊 記事構造分析:');
      console.log('- H1見出し:', h1Count);
      console.log('- H2見出し:', h2Count);
      console.log('- H3見出し:', h3Count);
      console.log('- 箇条書き:', bulletCount);
      console.log('- 数字データ:', numberMatches, '個');
      
      // 品質評価
      const isHighQuality = h1Count >= 1 && h2Count >= 3 && article.length >= 2000;
      const hasRichContent = bulletCount > 0 && numberMatches > 5;
      
      console.log('\\n🎯 品質評価:');
      console.log('- 基本構造:', isHighQuality ? '✅ 合格' : '❌ 不十分');
      console.log('- 内容の充実度:', hasRichContent ? '✅ 豊富' : '❌ 不足');
      
      // 最初の800文字を表示
      console.log('\\n📝 記事冒頭（800文字）:');
      console.log(article.substring(0, 800) + '...');
      
      return {
        success: true,
        articleLength: article.length,
        structure: { h1Count, h2Count, h3Count, bulletCount, numberMatches },
        quality: { isHighQuality, hasRichContent },
        inputLength: testData.length,
        tokenUsage: completion.usage
      };
    } else {
      console.log('生成された記事:', JSON.stringify(article));
      throw new Error('記事生成失敗');
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      status: error?.status
    });
    throw error;
  }
}

// 2つ目のテスト: より複雑なプロンプト
async function testComplexPromptWith800to1000() {
  try {
    console.log('\\n\\n=== 複雑プロンプトテスト ===');
    
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

    console.log('複雑プロンプト結果:');
    console.log('Status:', completion.status);
    console.log('記事文字数:', completion.output_text?.length || 0);
    
    if (completion.output_text && completion.output_text.length > 100) {
      fs.writeFileSync('./test-800-1000-complex-article.md', completion.output_text);
      console.log('✅ 複雑プロンプト記事を test-800-1000-complex-article.md に保存');
      return { success: true, length: completion.output_text.length };
    }
    
    return { success: false, length: 0 };
    
  } catch (error) {
    console.error('複雑プロンプトテスト失敗:', error.message);
    return { success: false, error: error.message };
  }
}

// 実行部分
async function runAllTests() {
  console.log('🔍 800-1000文字回答での記事生成システムテスト');
  
  try {
    // テスト1: 単純プロンプト
    const result1 = await test800to1000CharArticle();
    
    // テスト2: 複雑プロンプト  
    const result2 = await testComplexPromptWith800to1000();
    
    console.log('\\n\\n🎉 全テスト完了');
    console.log('単純プロンプト:', result1.success ? '✅ 成功' : '❌ 失敗');
    console.log('複雑プロンプト:', result2.success ? '✅ 成功' : '❌ 失敗');
    
    if (result1.success && result1.quality?.isHighQuality) {
      console.log('\\n✅ 結論: 800-1000文字の長文回答でも記事生成は正常動作');
      console.log(`📊 生成記事: ${result1.articleLength}文字`);
      console.log(`📊 入力データ: ${result1.inputLength}文字`);
    } else {
      console.log('\\n⚠️ 一部制限あり: 複雑なプロンプトでは出力が制限される場合がある');
    }
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
    process.exit(1);
  }
}

runAllTests();