// E2Eテスト: 質問生成制限とスキップ機能の検証
import fs from 'fs';

// 設定
const BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

// テストデータ
const testProject = {
  title: 'E2Eテスト用プロジェクト',
  theme: 'スタートアップの成長戦略',
  interviewee: '創業者（匿名）',
  description: 'E2Eテスト用の説明文'
};

// API呼び出しヘルパー
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
  
  console.log(`📡 API Call: ${method} ${endpoint}`);
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

// テスト1: 質問生成数の検証
async function testQuestionGeneration() {
  console.log('\n🧪 テスト1: 質問生成数の検証（5-7個制限）');
  
  try {
    // プロジェクト作成
    console.log('1. プロジェクト作成...');
    const project = await apiCall('/api/projects', 'POST', testProject);
    console.log(`✅ プロジェクト作成成功: ${project.id}`);
    
    // 質問生成
    console.log('2. 質問生成...');
    const questions = await apiCall('/api/questions', 'POST', {
      projectId: project.id,
      theme: testProject.theme,
      interviewee: testProject.interviewee
    });
    
    console.log(`📋 生成された質問数: ${questions.length}`);
    console.log('生成された質問:');
    questions.forEach((q, index) => {
      console.log(`  ${index + 1}. ${q.content || q}`);
    });
    
    // 検証
    if (questions.length >= 5 && questions.length <= 7) {
      console.log('✅ 質問数制限テスト: 合格');
      return { success: true, questionCount: questions.length, questions, projectId: project.id };
    } else {
      console.log(`❌ 質問数制限テスト: 失敗 (${questions.length}個生成)`);
      return { success: false, questionCount: questions.length, questions, projectId: project.id };
    }
    
  } catch (error) {
    console.error('❌ 質問生成テストエラー:', error.message);
    return { success: false, error: error.message };
  }
}

// テスト2: スキップ機能の検証（実際のDB経由）
async function testSkipFunctionality(projectId, questions) {
  console.log('\n🧪 テスト2: スキップ機能の検証');
  
  try {
    // 一部の質問に対して transcription を作成（一部をスキップ）
    console.log('1. 模擬転写データをDBに保存...');
    
    // 質問1と3のみに回答（2, 4以降をスキップ）
    const answeredIndexes = [0, 2];
    const mockAnswers = [
      '質問1への詳細な回答です。これは800文字程度の長い回答を想定しています。創業初期の課題として、プロダクトマーケットフィットの発見が最も重要でした。市場のニーズを正確に把握し、それに対応する製品を開発することで、初期の顧客獲得に成功しました。具体的には、顧客インタビューを100件以上実施し、ペインポイントを特定。そこから得られた洞察をもとに、MVPを3回改良し、最終的に市場にフィットする製品を完成させることができました。この過程で学んだことは、仮説検証の重要性と、顧客の声に真摯に耳を傾けることの価値です。',
      '質問3への回答です。チーム作りにおいては、スキルの多様性と文化の統一を重視しました。特に初期メンバーの採用では、技術力だけでなく、会社のビジョンに共感し、困難な状況でも前向きに取り組める人材を厳選しました。結果として、創業から2年で30名の優秀なチームを構築することができ、各分野のエキスパートが集まる組織になりました。採用プロセスでは、実務課題を通じた評価や、既存メンバーとの相性確認を重視し、長期的な成長を見据えた人材選定を行いました。'
    ];
    
    // 模擬転写データを作成（combined-interview形式）
    const combinedTranscriptionText = answeredIndexes.map((qIndex, aIndex) => {
      const question = questions[qIndex];
      const answer = mockAnswers[aIndex];
      return `質問${qIndex + 1}: ${question.content || question}\n回答${qIndex + 1}: ${answer}`;
    }).join('\n\n');
    
    // 転写データをDBに保存（combined-interview）
    const transcriptionData = await apiCall('/api/transcribe-combined', 'POST', {
      projectId: projectId,
      text: combinedTranscriptionText
    });
    
    console.log(`📝 回答された質問: ${answeredIndexes.length}/${questions.length}`);
    console.log('スキップされた質問:');
    questions.forEach((q, index) => {
      if (!answeredIndexes.includes(index)) {
        console.log(`  質問${index + 1}: ${(q.content || q).substring(0, 50)}...`);
      }
    });
    
    // 記事生成テスト
    console.log('2. 記事生成（スキップされた質問を除外）...');
    
    const articleResponse = await apiCall('/api/draft', 'POST', {
      projectId: projectId,
      articleType: 'BLOG_POST'
    });
    
    console.log('✅ 記事生成成功');
    console.log(`📄 記事文字数: ${articleResponse.content.length}`);
    
    // 記事内容の検証（スキップした質問に関する内容が含まれていないかチェック）
    const skippedQuestionNumbers = [2, 4, 5, 6, 7].filter(n => n <= questions.length);
    
    let hasSkippedContent = false;
    skippedQuestionNumbers.forEach(qNum => {
      if (articleResponse.content.includes(`質問${qNum}`)) {
        console.log(`⚠️ スキップされた質問${qNum}の内容が記事に含まれています`);
        hasSkippedContent = true;
      }
    });
    
    // 回答した質問は含まれているか確認
    const answeredQuestionNumbers = [1, 3];
    let hasAnsweredContent = answeredQuestionNumbers.some(qNum => 
      articleResponse.content.includes('プロダクトマーケットフィット') || 
      articleResponse.content.includes('チーム作り')
    );
    
    if (!hasSkippedContent && hasAnsweredContent) {
      console.log('✅ スキップ機能テスト: 合格（スキップした質問は除外、回答した質問は含まれている）');
      return { success: true, articleLength: articleResponse.content.length };
    } else {
      console.log('❌ スキップ機能テスト: 失敗');
      if (hasSkippedContent) console.log('  - スキップした質問の内容が含まれています');
      if (!hasAnsweredContent) console.log('  - 回答した質問の内容が含まれていません');
      return { success: false, articleLength: articleResponse.content.length };
    }
    
  } catch (error) {
    console.error('❌ スキップ機能テストエラー:', error.message);
    return { success: false, error: error.message };
  }
}

// テスト3: 全体ワークフローの統合テスト
async function testCompleteWorkflow() {
  console.log('\n🧪 テスト3: 全体ワークフロー統合テスト');
  
  try {
    console.log('1. 新規プロジェクトでフルワークフローテスト...');
    
    // プロジェクト作成
    const project = await apiCall('/api/projects', 'POST', {
      ...testProject,
      title: 'ワークフローテスト用プロジェクト'
    });
    
    // 質問生成
    const questions = await apiCall('/api/questions', 'POST', {
      projectId: project.id,
      theme: testProject.theme,
      interviewee: testProject.interviewee
    });
    
    // 模擬回答（最初の2問のみ回答、残りはスキップ）
    const selectedTranscriptions = questions.slice(0, 2).map((q, index) => 
      `質問${index + 1}: ${q.content || q}\n回答${index + 1}: これはE2Eテスト用の模擬回答です。実際のインタビューでは、もっと詳細で具体的な内容が含まれます。テスト目的のため、800文字程度の長さを想定して作成しています。創業の背景、課題解決のアプローチ、成功事例、失敗経験、学んだ教訓、今後の展望などについて詳しく回答していただく想定です。`.repeat(2)
    ).join('\n\n');
    
    // 転写データを保存
    await apiCall('/api/transcribe-combined', 'POST', {
      projectId: project.id,
      text: selectedTranscriptions
    });
    
    // 記事生成
    const article = await apiCall('/api/draft', 'POST', {
      projectId: project.id,
      articleType: 'BLOG_POST'
    });
    
    console.log('✅ 全体ワークフロー完了');
    console.log(`📊 最終結果:`);
    console.log(`- プロジェクトID: ${project.id}`);
    console.log(`- 生成質問数: ${questions.length}`);
    console.log(`- 回答数: 2/${questions.length}`);
    console.log(`- 記事文字数: ${article.content.length}`);
    
    // 結果保存
    const testResult = {
      projectId: project.id,
      questionCount: questions.length,
      answeredCount: 2,
      skippedCount: questions.length - 2,
      articleLength: article.content.length,
      article: article.content.substring(0, 500) + '...' // 最初の500文字のみ保存
    };
    
    fs.writeFileSync('./test-e2e-result.json', JSON.stringify(testResult, null, 2));
    console.log('✅ テスト結果をtest-e2e-result.jsonに保存');
    
    return { success: true, ...testResult };
    
  } catch (error) {
    console.error('❌ 統合テストエラー:', error.message);
    return { success: false, error: error.message };
  }
}

// メイン実行関数
async function runE2ETests() {
  console.log('🚀 E2Eテスト開始: 質問制限とスキップ機能の検証');
  console.log('============================================');
  
  const results = {};
  
  try {
    // テスト1: 質問生成数の検証
    results.questionGeneration = await testQuestionGeneration();
    
    // テスト2: スキップ機能の検証
    if (results.questionGeneration.success) {
      results.skipFunctionality = await testSkipFunctionality(
        results.questionGeneration.projectId,
        results.questionGeneration.questions
      );
    }
    
    // テスト3: 全体ワークフロー
    results.completeWorkflow = await testCompleteWorkflow();
    
    // 総合結果
    console.log('\n🎉 E2Eテスト完了');
    console.log('============================================');
    console.log('📊 総合結果:');
    console.log(`- 質問生成制限: ${results.questionGeneration?.success ? '✅ 合格' : '❌ 失敗'}`);
    console.log(`- スキップ機能: ${results.skipFunctionality?.success ? '✅ 合格' : '❌ 失敗'}`);
    console.log(`- 統合ワークフロー: ${results.completeWorkflow?.success ? '✅ 合格' : '❌ 失敗'}`);
    
    const allTestsPassed = Object.values(results).every(result => result?.success);
    
    if (allTestsPassed) {
      console.log('\n🎯 結論: ✅ 全テスト合格！修正が正常に動作しています');
    } else {
      console.log('\n🎯 結論: ❌ 一部テスト失敗。修正が必要です');
    }
    
    // 結果詳細保存
    fs.writeFileSync('./test-e2e-complete-results.json', JSON.stringify(results, null, 2));
    console.log('📝 詳細結果をtest-e2e-complete-results.jsonに保存');
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('❌ E2Eテスト実行エラー:', error.message);
    return false;
  }
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('⚠️ 注意: Next.jsアプリが http://localhost:3000 で起動していることを確認してください');
  console.log('起動方法: npm run dev');
  console.log('');
  
  runE2ETests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('E2Eテスト実行失敗:', error);
    process.exit(1);
  });
}

export default runE2ETests;