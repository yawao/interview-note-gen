/**
 * インタビュー抽出機能の統合テスト
 * 実際のLLM呼び出しを含むE2Eテスト
 */

// TypeScript関数を直接呼び出すためのテストスクリプトを作成
import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:3000'

async function callStructuredExtraction(transcript, questions) {
  // プロジェクト作成
  const project = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'テスト用プロジェクト',
      theme: 'テスト',
      interviewee: 'テスト者',
      description: 'テスト用'
    })
  }).then(r => r.json())

  // 質問作成
  await fetch(`${BASE_URL}/api/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id,
      theme: 'テスト',
      interviewee: 'テスト者'
    })
  })

  // 転写データ保存
  await fetch(`${BASE_URL}/api/transcribe-combined`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id,
      text: transcript
    })
  })

  // 構造化抽出実行
  const result = await fetch(`${BASE_URL}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: project.id
    })
  }).then(r => r.json())

  return {
    summary: result.structured,
    metadata: result.metadata
  }
}
import fs from 'fs'

// テストケース
const testCases = [
  {
    name: 'ケースA: 3問中2問のみ根拠のある回答',
    questions: [
      "創業の背景について教えてください",
      "プロダクトマーケットフィットの過程を教えてください", 
      "チーム作りで重視したことは何ですか"
    ],
    transcript: `
      創業の背景については、前職でエンジニアとして働いていた時に課題を感じたことがきっかけです。
      多くの企業でデータ分析が適切に行われていないという問題がありました。
      そこで2019年に会社を設立し、データ分析プラットフォームの開発を開始しました。
      
      チーム作りでは技術力だけでなく、会社のビジョンに共感してくれる人材を重視しました。
      初期メンバーの採用では、実際の課題を一緒に解決してもらう実務テストを導入し、
      相性を確認するプロセスを設けました。結果として優秀なチームを構築できました。
    `,
    expectedAnswered: 2,
    expectedUnanswered: 1
  },
  
  {
    name: 'ケースB: 全ての質問に根拠のある回答',
    questions: [
      "資金調達の経験について教えてください",
      "最大の困難は何でしたか",
      "成功の要因は何ですか"
    ],
    transcript: `
      資金調達については、シードラウンドで500万円を調達しました。
      投資家は元々知り合いだったエンジェル投資家で、事業計画に共感してくれました。
      
      最大の困難は初期のユーザー獲得でした。プロダクトはあったものの、
      マーケティングのノウハウがなく、最初の1年は苦労しました。
      
      成功の要因は何と言ってもチームワークです。優秀なメンバーと
      粘り強く課題解決に取り組んだことが結果につながりました。
    `,
    expectedAnswered: 3,
    expectedUnanswered: 0
  },

  {
    name: 'ケースC: 根拠の薄い回答（自動ダウンシフトテスト）',
    questions: [
      "売上について教えてください",
      "従業員数は何人ですか",
      "今後の展望を教えてください"
    ],
    transcript: `
      昨年の売上は順調に成長しました。詳細な数字は言えませんが、
      前年比で大幅に増加しています。
      
      今後の展望としては、海外展開を視野に入れています。
      まずはアジア市場から始める予定です。
    `,
    expectedAnswered: 2, // 従業員数は根拠なしでunanswered期待
    expectedUnanswered: 1
  }
]

async function runTest(testCase) {
  console.log(`\n🧪 ${testCase.name}`)
  console.log('=' .repeat(50))
  
  try {
    const result = await callStructuredExtraction(
      testCase.transcript,
      testCase.questions
    )

    // 基本検証
    console.log(`📊 結果:`)
    console.log(`- 質問数: ${testCase.questions.length}`)
    console.log(`- 項目数: ${result.summary.items.length}`)
    console.log(`- 回答数: ${result.summary.items.filter(item => item.status === 'answered').length}`)
    console.log(`- 未回答数: ${result.summary.items.filter(item => item.status === 'unanswered').length}`)
    console.log(`- バリデーション: ${result.metadata.validationPassed ? '✅' : '❌'}`)
    console.log(`- 修復試行: ${result.metadata.repairAttempted ? 'あり' : 'なし'}`)

    // 期待値チェック
    const actualAnswered = result.summary.items.filter(item => item.status === 'answered').length
    const actualUnanswered = result.summary.items.filter(item => item.status === 'unanswered').length
    
    const answeredMatch = actualAnswered === testCase.expectedAnswered
    const unansweredMatch = actualUnanswered === testCase.expectedUnanswered
    const lengthMatch = result.summary.items.length === testCase.questions.length

    console.log(`\n✅ 検証結果:`)
    console.log(`- 項目数一致: ${lengthMatch ? '✅' : '❌'} (期待=${testCase.questions.length}, 実際=${result.summary.items.length})`)
    console.log(`- 回答数一致: ${answeredMatch ? '✅' : '❌'} (期待=${testCase.expectedAnswered}, 実際=${actualAnswered})`)
    console.log(`- 未回答数一致: ${unansweredMatch ? '✅' : '❌'} (期待=${testCase.expectedUnanswered}, 実際=${actualUnanswered})`)

    // Evidence検証
    console.log(`\n📋 詳細結果:`)
    result.summary.items.forEach((item, index) => {
      console.log(`Q${index + 1}: ${item.question}`)
      console.log(`  ステータス: ${item.status}`)
      console.log(`  回答: ${item.answer || '未回答'}`)
      console.log(`  根拠: ${item.evidence.length}件 [${item.evidence.map(e => `"${e.substring(0, 30)}..."`).join(', ')}]`)
    })

    // メタデータ
    if (result.metadata.error) {
      console.log(`\n⚠️ エラー: ${result.metadata.error}`)
    }

    return {
      success: lengthMatch && answeredMatch && unansweredMatch,
      details: {
        lengthMatch,
        answeredMatch, 
        unansweredMatch,
        actualAnswered,
        actualUnanswered,
        metadata: result.metadata
      }
    }

  } catch (error) {
    console.error(`❌ テスト実行エラー:`, error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

async function runAllTests() {
  console.log('🚀 インタビュー抽出機能 統合テスト開始')
  console.log('このテストは実際のLLM（gpt-5-mini）を呼び出します')
  
  const results = []
  
  for (const testCase of testCases) {
    const result = await runTest(testCase)
    results.push({ ...result, name: testCase.name })
    
    // テスト間の間隔
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  // 総合結果
  console.log('\n🎉 全テスト完了')
  console.log('=' .repeat(60))
  
  const passedTests = results.filter(r => r.success).length
  const totalTests = results.length
  
  console.log(`📊 総合結果: ${passedTests}/${totalTests} 合格 (${Math.round(passedTests/totalTests*100)}%)`)
  
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.name}`)
    if (result.error) {
      console.log(`   エラー: ${result.error}`)
    }
  })

  // 詳細な統計
  const allSuccessful = results.filter(r => r.details?.metadata?.validationPassed)
  const repairAttempted = results.filter(r => r.details?.metadata?.repairAttempted)
  
  console.log(`\n📈 統計:`)
  console.log(`- バリデーション成功: ${allSuccessful.length}/${totalTests}`)
  console.log(`- 修復が必要だった: ${repairAttempted.length}/${totalTests}`)
  
  // 結果をファイルに保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportData = {
    timestamp,
    summary: {
      passed: passedTests,
      total: totalTests,
      successRate: Math.round(passedTests/totalTests*100)
    },
    results
  }
  
  fs.writeFileSync(`./test-interview-extraction-report-${timestamp}.json`, JSON.stringify(reportData, null, 2))
  console.log(`\n📝 詳細レポートを test-interview-extraction-report-${timestamp}.json に保存`)

  return passedTests === totalTests
}

// 実行
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('⚠️ 注意: このテストは実際のOpenAI APIを呼び出します')
  console.log('OPENAI_API_KEY環境変数が設定されていることを確認してください\n')
  
  runAllTests().then(success => {
    process.exit(success ? 0 : 1)
  }).catch(error => {
    console.error('テスト実行失敗:', error)
    process.exit(1)
  })
}

export default runAllTests