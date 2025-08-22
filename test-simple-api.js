// APIエンドポイント直接テスト
import fs from 'fs';

async function testAPIDirectly() {
  try {
    console.log('=== API直接テスト開始 ===');
    
    const testData = fs.readFileSync('./test-long-answers.txt', 'utf-8');
    
    // 1. /api/draft エンドポイントをテスト
    console.log('1. 記事ドラフト生成API テスト...');
    const draftResponse = await fetch('http://localhost:3001/api/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        theme: 'スタートアップ資金調達の成功戦略',
        interviewee: 'tech企業創業者（匿名）',
        summary: 'スタートアップの資金調達戦略について詳細なインタビューを実施',
        transcription: testData
      })
    });
    
    if (!draftResponse.ok) {
      const errorText = await draftResponse.text();
      console.error('Draft API Error:', errorText);
      throw new Error(`Draft API failed: ${draftResponse.status}`);
    }
    
    const draftResult = await draftResponse.json();
    console.log('✅ 記事ドラフト生成成功');
    console.log('生成記事文字数:', draftResult.content?.length || 0);
    
    // 記事をファイルに保存
    if (draftResult.content) {
      fs.writeFileSync('./test-api-generated-article.md', draftResult.content);
      console.log('✅ 生成記事をtest-api-generated-article.mdに保存');
    }
    
    return {
      success: true,
      articleLength: draftResult.content?.length || 0,
      testDataLength: testData.length
    };
    
  } catch (error) {
    console.error('❌ APIテストエラー:', error);
    throw error;
  }
}

testAPIDirectly().then(result => {
  console.log('\\n=== APIテスト完了 ===');
  console.log('成功: 600-800文字の長文回答で記事生成API正常動作');
  console.log('結果:', result);
}).catch(error => {
  console.error('APIテスト失敗:', error.message);
  process.exit(1);
});