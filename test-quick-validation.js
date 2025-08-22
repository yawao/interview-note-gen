// 高速検証テスト: 質問生成制限の確認
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

async function testQuestionLimit() {
  console.log('🧪 質問生成制限テスト（3回実行）');
  
  const testProject = {
    title: 'クイック検証テスト',
    theme: 'スタートアップの成長戦略',
    interviewee: '創業者（匿名）',
    description: 'クイック検証用'
  };
  
  const results = [];
  
  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`\n--- 実行${i} ---`);
      
      // プロジェクト作成
      const project = await apiCall('/api/projects', 'POST', {
        ...testProject,
        title: `${testProject.title}${i}`
      });
      console.log(`プロジェクト作成: ${project.id}`);
      
      // 質問生成
      const questions = await apiCall('/api/questions', 'POST', {
        projectId: project.id,
        theme: testProject.theme,
        interviewee: testProject.interviewee
      });
      
      console.log(`質問数: ${questions.length}`);
      console.log('質問一覧:');
      questions.forEach((q, index) => {
        console.log(`  ${index + 1}. ${(q.content || q).substring(0, 80)}...`);
      });
      
      const isValid = questions.length >= 5 && questions.length <= 7;
      console.log(`制限チェック: ${isValid ? '✅ 合格' : '❌ 失敗'} (${questions.length}個)`);
      
      results.push({
        run: i,
        questionCount: questions.length,
        isValid,
        questions: questions.map(q => q.content || q)
      });
      
    } catch (error) {
      console.error(`実行${i}でエラー:`, error.message);
      results.push({
        run: i,
        error: error.message,
        isValid: false
      });
    }
  }
  
  // 結果サマリー
  console.log('\n📊 結果サマリー');
  console.log('================');
  
  const validResults = results.filter(r => r.isValid);
  const questionCounts = results.filter(r => r.questionCount).map(r => r.questionCount);
  
  console.log(`成功率: ${validResults.length}/3 (${Math.round(validResults.length/3*100)}%)`);
  console.log(`質問数: ${questionCounts.join(', ')}`);
  console.log(`平均質問数: ${questionCounts.length ? Math.round(questionCounts.reduce((a,b) => a+b, 0)/questionCounts.length) : 0}`);
  
  if (validResults.length === 3) {
    console.log('🎉 全テスト合格: 質問数制限が正常に機能しています');
  } else if (validResults.length > 0) {
    console.log('⚠️ 部分的成功: 一部のテストで制限が効いています');
  } else {
    console.log('❌ 全テスト失敗: 質問数制限が機能していません');
  }
  
  return validResults.length === 3;
}

// 実行
testQuestionLimit().then(success => {
  console.log(`\n最終結果: ${success ? '完全成功' : '改善が必要'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
});