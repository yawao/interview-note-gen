// 最終検証テスト
import { generateArticleDraft } from './src/lib/openai.ts';
import fs from 'fs';

async function validateFullSystem() {
  try {
    console.log('=== 最終システム検証テスト ===');
    
    const testData = fs.readFileSync('./test-long-answers.txt', 'utf-8');
    console.log('テストデータ文字数:', testData.length);
    
    console.log('\\n実際のgenerateArticleDraft関数をテスト...');
    
    const article = await generateArticleDraft(
      'スタートアップ資金調達の成功戦略',
      'tech企業創業者（匿名）',
      'スタートアップの資金調達戦略について詳細なインタビューを実施',
      testData
    );
    
    console.log('\\n✅ 記事生成成功');
    console.log('記事文字数:', article.length);
    
    if (article && article.length > 500) {
      fs.writeFileSync('./test-final-article.md', article);
      console.log('✅ 最終記事をtest-final-article.mdに保存');
      
      // 記事の品質チェック
      const h1Count = (article.match(/^# /gm) || []).length;
      const h2Count = (article.match(/^## /gm) || []).length;
      const h3Count = (article.match(/^### /gm) || []).length;
      const bulletCount = (article.match(/^[・\-\*]/gm) || []).length;
      
      console.log('\\n📊 記事品質分析:');
      console.log('- H1見出し:', h1Count);
      console.log('- H2見出し:', h2Count);  
      console.log('- H3見出し:', h3Count);
      console.log('- 箇条書き:', bulletCount);
      
      // PHASE0基準チェック
      const hasNumbers = /\d+[%億万円年月日時間分週]/g.test(article);
      const hasProperNouns = /[A-Z][a-zA-Z]+|[株会社クラウド企業システム技術]/g.test(article);
      
      console.log('\\n✅ PHASE0基準チェック:');
      console.log('- 数字・データ含有:', hasNumbers ? '✅' : '❌');
      console.log('- 固有名詞含有:', hasProperNouns ? '✅' : '❌');
      console.log('- 箇条書き:', bulletCount > 0 ? '✅' : '❌');
      
      const qualityScore = (h2Count >= 3 ? 1 : 0) + 
                          (hasNumbers ? 1 : 0) + 
                          (hasProperNouns ? 1 : 0) + 
                          (bulletCount > 0 ? 1 : 0);
      
      console.log('\\n🎯 品質スコア:', qualityScore, '/ 4');
      
      return {
        success: true,
        articleLength: article.length,
        structure: { h1Count, h2Count, h3Count, bulletCount },
        qualityScore,
        testDataLength: testData.length
      };
    } else {
      throw new Error('生成された記事が短すぎます');
    }
    
  } catch (error) {
    console.error('❌ 最終検証エラー:', error);
    throw error;
  }
}

// Node.js直接実行の場合
if (import.meta.url === `file://${process.argv[1]}`) {
  validateFullSystem().then(result => {
    console.log('\\n🎉 最終検証完了!');
    console.log('結果:', result);
    if (result.qualityScore >= 3) {
      console.log('\\n✅ 600-800文字の長文回答での記事生成システム: 正常動作確認');
    } else {
      console.log('\\n⚠️ 品質改善が必要です');
    }
  }).catch(error => {
    console.error('❌ 最終検証失敗:', error.message);
    process.exit(1);
  });
}

export default validateFullSystem;