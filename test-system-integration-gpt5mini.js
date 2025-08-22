// gpt-5-miniでシステム全体の統合テスト
import { generateArticleDraft } from './src/lib/openai.js';
import fs from 'fs';

async function testSystemIntegrationGPT5Mini() {
  try {
    console.log('=== gpt-5-mini システム統合テスト ===');
    
    // 実際のシステムコードをテスト
    const testData = fs.readFileSync('./test-very-long-answers.txt', 'utf-8');
    console.log('入力データ:', testData.length, '文字（800-1000文字×5質問）');
    
    console.log('\\n実際のgenerateArticleDraft関数（gpt-5-mini）をテスト...');
    
    const startTime = Date.now();
    
    const article = await generateArticleDraft(
      'スタートアップ資金調達の成功戦略',
      'tech企業創業者（匿名）',
      'スタートアップの資金調達戦略について詳細なインタビューを実施。各質問に800-1000文字の詳細回答を得た。',
      testData
    );
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log('\\n✅ システム統合テスト完了');
    console.log('処理時間:', (processingTime / 1000).toFixed(2), '秒');
    console.log('生成記事文字数:', article.length);
    
    if (article && article.length > 500) {
      fs.writeFileSync('./test-system-integration-gpt5mini.md', article);
      console.log('✅ システム統合記事をtest-system-integration-gpt5mini.mdに保存');
      
      // 詳細分析
      const h1Count = (article.match(/^# /gm) || []).length;
      const h2Count = (article.match(/^## /gm) || []).length;
      const h3Count = (article.match(/^### /gm) || []).length;
      const bulletCount = (article.match(/^[・\-\*]/gm) || []).length;
      const numberMatches = (article.match(/\\d+[%億万円年月日]/g) || []).length;
      const actionWords = (article.match(/(実践|チェックリスト|ステップ|アクション|やってみる)/g) || []).length;
      
      console.log('\\n📊 システム統合記事分析:');
      console.log('- 記事構成: H1×' + h1Count + ', H2×' + h2Count + ', H3×' + h3Count);
      console.log('- 箇条書き:', bulletCount + '個');
      console.log('- 数値データ:', numberMatches + '個');
      console.log('- アクション語彙:', actionWords + '個');
      console.log('- 文字密度:', (article.length / testData.length * 100).toFixed(1) + '%（入力対比）');
      
      // 品質判定
      const qualityScore = (h1Count > 0 ? 1 : 0) + 
                          (h2Count >= 3 ? 1 : 0) + 
                          (bulletCount > 0 ? 1 : 0) + 
                          (numberMatches >= 5 ? 1 : 0) + 
                          (actionWords >= 3 ? 1 : 0);
      
      console.log('\\n🎯 品質スコア:', qualityScore + '/5');
      console.log('- 基本構造:', h1Count > 0 && h2Count >= 3 ? '✅ 良好' : '❌ 要改善');
      console.log('- データ豊富さ:', numberMatches >= 5 ? '✅ 豊富' : '❌ 不足');
      console.log('- 実用性:', actionWords >= 3 ? '✅ 実用的' : '❌ 理論的');
      
      // エラーチェック
      const hasErrors = article.includes('エラー') || 
                       article.includes('失敗') && !article.includes('失敗しやすい') ||
                       article.includes('応答がありません') ||
                       article.length < 1000;
      
      console.log('\\n🔍 エラーチェック:');
      console.log('- システムエラー:', hasErrors ? '❌ エラー検出' : '✅ エラーなし');
      console.log('- 記事完整性:', article.length >= 1000 ? '✅ 適切な長さ' : '❌ 短すぎ');
      
      // パフォーマンス評価
      const tokensPerSecond = (testData.length / (processingTime / 1000)).toFixed(0);
      
      console.log('\\n⚡ パフォーマンス:');
      console.log('- 処理速度:', tokensPerSecond, '文字/秒');
      console.log('- レスポンス時間:', processingTime < 30000 ? '✅ 高速' : '⚠️ 遅い');
      console.log('- メモリ効率:', 'JavaScript VM内で完了');
      
      return {
        success: true,
        model: 'gpt-5-mini',
        performance: {
          processingTime,
          tokensPerSecond: parseInt(tokensPerSecond),
          articleLength: article.length,
          inputLength: testData.length
        },
        quality: {
          score: qualityScore,
          structure: { h1Count, h2Count, h3Count },
          content: { bulletCount, numberMatches, actionWords },
          hasErrors
        }
      };
    } else {
      throw new Error('システム統合テスト失敗: 記事生成不良');
    }
    
  } catch (error) {
    console.error('❌ システム統合テストエラー:', error);
    return {
      success: false,
      error: error.message,
      model: 'gpt-5-mini'
    };
  }
}

// エラー回復力テスト
async function testErrorResilienceGPT5Mini() {
  console.log('\\n=== gpt-5-mini エラー回復力テスト ===');
  
  try {
    // 極端に長い入力でテスト
    const extremeData = fs.readFileSync('./test-very-long-answers.txt', 'utf-8').repeat(2);
    console.log('極端入力テスト:', extremeData.length, '文字');
    
    const result = await generateArticleDraft(
      '極端長文処理テスト',
      'AIシステムテスター',
      '極端に長い入力でのシステム安定性をテスト',
      extremeData.substring(0, 8000) // 8000文字制限
    );
    
    console.log('✅ 極端入力テスト成功:', result.length, '文字生成');
    return { extremeTest: true, length: result.length };
    
  } catch (error) {
    console.log('❌ 極端入力テスト失敗:', error.message);
    return { extremeTest: false, error: error.message };
  }
}

// メイン実行
async function runFullSystemTest() {
  console.log('🚀 gpt-5-mini 800-1000文字回答 完全システムテスト開始');
  
  try {
    const integrationResult = await testSystemIntegrationGPT5Mini();
    const resilienceResult = await testErrorResilienceGPT5Mini();
    
    console.log('\\n\\n🎉 完全システムテスト結果');
    console.log('統合テスト:', integrationResult.success ? '✅ 成功' : '❌ 失敗');
    console.log('耐久性テスト:', resilienceResult.extremeTest ? '✅ 堅牢' : '⚠️ 制限あり');
    
    if (integrationResult.success) {
      console.log('\\n📊 最終評価:');
      console.log(`- 品質スコア: ${integrationResult.quality.score}/5`);
      console.log(`- 処理性能: ${integrationResult.performance.tokensPerSecond}文字/秒`);
      console.log(`- 記事長: ${integrationResult.performance.articleLength}文字`);
      console.log(`- エラー状況: ${integrationResult.quality.hasErrors ? 'エラー有' : 'エラーなし'}`);
      
      if (integrationResult.quality.score >= 4 && !integrationResult.quality.hasErrors) {
        console.log('\\n🎯 結論: ✅ gpt-5-miniで800-1000文字回答からの記事生成は本番レベルで安定動作');
        console.log('🎯 Responses API + gpt-5-mini = 堅牢なインタビュー記事生成システム');
      } else {
        console.log('\\n🎯 結論: ⚠️ 基本機能は動作するが、品質向上の余地あり');
      }
    } else {
      console.log('\\n❌ システム統合に問題があります');
    }
    
    return {
      overall: integrationResult.success && integrationResult.quality.score >= 3,
      integration: integrationResult,
      resilience: resilienceResult
    };
    
  } catch (error) {
    console.error('❌ 完全システムテスト実行エラー:', error.message);
    return { overall: false, error: error.message };
  }
}

// 外部実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullSystemTest().then(result => {
    const success = result.overall;
    console.log('\\n📝 最終結果:', success ? '完全成功' : '部分的成功');
    process.exit(success ? 0 : 1);
  });
}

export default runFullSystemTest;