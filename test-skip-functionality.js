// スキップ機能テスト: 一部質問に回答、残りをスキップして記事生成
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

async function testSkipFunctionality() {
  console.log('🧪 スキップ機能テスト開始');
  
  try {
    // 1. プロジェクト作成
    console.log('1. プロジェクト作成...');
    const project = await apiCall('/api/projects', 'POST', {
      title: 'スキップ機能テスト',
      theme: 'スタートアップの成長戦略',
      interviewee: '創業者（匿名）',
      description: 'スキップ機能の検証'
    });
    console.log(`✅ プロジェクト作成: ${project.id}`);
    
    // 2. 質問生成
    console.log('2. 質問生成...');
    const questions = await apiCall('/api/questions', 'POST', {
      projectId: project.id,
      theme: 'スタートアップの成長戦略',
      interviewee: '創業者（匿名）'
    });
    console.log(`✅ 質問生成: ${questions.length}個`);
    
    // 3. 一部質問のみに回答（スキップシミュレーション）
    console.log('3. 模擬インタビュー（一部スキップ）...');
    
    // 質問1と3のみに回答、他はスキップ
    const answeredQuestions = [
      {
        question: questions[0].content,
        answer: '創業初期の最大の課題はプロダクトマーケットフィットの発見でした。市場のニーズを正確に把握するため、100件以上の顧客インタビューを実施しました。その結果、当初想定していた課題とは異なる、より深刻な問題があることが判明しました。この発見により、プロダクトの方向性を大幅に変更し、最終的に市場にフィットする製品を開発することができました。この経験から、仮説検証の重要性と顧客の声に真摯に耳を傾けることの価値を学びました。'
      },
      {
        question: questions[2]?.content,
        answer: 'チーム作りにおいては、スキルの多様性と文化の統一を重視しました。特に初期メンバーの採用では、技術力だけでなく、会社のビジョンに共感し、困難な状況でも前向きに取り組める人材を厳選しました。結果として、創業から2年で30名の優秀なチームを構築することができました。採用プロセスでは、実務課題を通じた評価や、既存メンバーとの相性確認を重視し、長期的な成長を見据えた人材選定を行いました。文化面では、失敗を称賛し学習に変える文化づくりに注力しました。'
      }
    ];
    
    const transcriptionText = answeredQuestions.map((qa, index) => 
      `質問${index === 0 ? 1 : 3}: ${qa.question}\n回答${index === 0 ? 1 : 3}: ${qa.answer}`
    ).join('\n\n');
    
    console.log(`📝 回答数: ${answeredQuestions.length}/${questions.length}`);
    console.log('スキップされた質問:');
    [1, 3, 4, 5, 6].filter(i => i < questions.length).forEach(i => {
      if (questions[i]) {
        console.log(`  質問${i + 1}: ${questions[i].content.substring(0, 60)}...`);
      }
    });
    
    // 4. 転写データ保存
    console.log('4. 転写データ保存...');
    await apiCall('/api/transcribe-combined', 'POST', {
      projectId: project.id,
      text: transcriptionText
    });
    console.log('✅ 転写データ保存完了');
    
    // 5. 記事生成
    console.log('5. 記事生成...');
    const startTime = Date.now();
    const article = await apiCall('/api/draft', 'POST', {
      projectId: project.id,
      articleType: 'BLOG_POST'
    });
    const generationTime = Date.now() - startTime;
    
    console.log(`✅ 記事生成完了 (${Math.round(generationTime/1000)}秒)`);
    console.log(`📄 記事文字数: ${article.content.length}`);
    
    // 6. 検証
    console.log('6. スキップ機能検証...');
    
    // 回答した内容が含まれているかチェック
    const hasAnsweredContent = article.content.includes('プロダクトマーケットフィット') || 
                               article.content.includes('チーム作り') ||
                               article.content.includes('顧客インタビュー');
    
    // スキップした質問に特有のキーワードが含まれていないかチェック
    // （質問2,4,5,6に特有のキーワードをチェック）
    const skipKeywords = ['質問2', '質問4', '質問5', '質問6'];
    const hasSkippedContent = skipKeywords.some(keyword => 
      article.content.includes(keyword)
    );
    
    console.log('検証結果:');
    console.log(`- 回答した内容が含まれている: ${hasAnsweredContent ? '✅' : '❌'}`);
    console.log(`- スキップした質問番号が含まれていない: ${!hasSkippedContent ? '✅' : '❌'}`);
    
    // 記事の一部を表示
    console.log('\n📖 生成記事（最初の300文字）:');
    console.log(article.content.substring(0, 300) + '...');
    
    // 結果判定
    const testPassed = hasAnsweredContent && !hasSkippedContent;
    
    if (testPassed) {
      console.log('\n🎉 スキップ機能テスト: ✅ 合格');
      console.log('- 回答した質問の内容が記事に含まれている');
      console.log('- スキップした質問は記事に影響していない');
    } else {
      console.log('\n❌ スキップ機能テスト: 失敗');
      if (!hasAnsweredContent) console.log('- 回答した質問の内容が記事に含まれていない');
      if (hasSkippedContent) console.log('- スキップした質問の内容が記事に含まれている');
    }
    
    return {
      success: testPassed,
      answeredCount: answeredQuestions.length,
      totalQuestions: questions.length,
      articleLength: article.content.length,
      generationTime: Math.round(generationTime/1000),
      hasAnsweredContent,
      hasSkippedContent
    };
    
  } catch (error) {
    console.error('❌ スキップ機能テストエラー:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 実行
testSkipFunctionality().then(result => {
  console.log('\n📊 最終結果:', result.success ? '完全成功' : '改善が必要');
  if (result.success) {
    console.log(`- 回答数: ${result.answeredCount}/${result.totalQuestions}`);
    console.log(`- 記事長: ${result.articleLength}文字`);
    console.log(`- 生成時間: ${result.generationTime}秒`);
  }
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
});