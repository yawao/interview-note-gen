// Bパス構造ガード版: gpt-5-mini 800-1000文字記事生成テスト
// 従来版との比較分析付き
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Bパス構造ガード用のプロンプト定義（共通）
const STRUCTURED_ARTICLE_SYSTEM_PROMPT = `あなたはプロの編集者です。インタビュー素材から読み物記事を作成します。以下を厳守してください：

CRITICAL CONSTRAINTS:
- 出力はJSONのみ。Markdownやテキスト記号は一切使用禁止
- sectionsは必ず3-5個（範囲外は不合格）
- 重複するh2見出しは絶対禁止（意味が重なる場合は統合する）
- body内に見出し記号（#, ##, ###, H1:, H2:等）を含めない
- 文途中で章を切り替えない（途切れ禁止）
- 推測で未回答を補完しない（必要なら「この点は未回答」と明示）

FORBIDDEN ACTIONS (絶対禁止):
- Markdownの見出し記号（#, ##, ###）の出力
- body内での見出し形式（H1:, H2-1, ■見出し■等）の使用
- 同一または類似のh2見出しの重複作成
- 文章の途中での見出し開始（例: 「ROIが## まとめ」）
- JSON以外の前置き・後置き文章
- 推測による内容の水増しや創作

OUTPUT FORMAT:
- 厳密なJSONスキーマに従う（StructuredArticle）
- title: 30-40文字の魅力的なタイトル
- lead: 3-4文の記事概要（読者メリット明示）
- sections: 3-5個のセクション（各400-600文字推奨）
- faq: オプション（質問と回答のペア）
- cta: オプション（行動喚起）

STRUCTURE RULES:
1. sectionsの各bodyは完結した内容にする
2. h2は読者が理解しやすい見出しにする
3. 各セクションは独立して読める構成にする
4. 数字・データ・具体例を積極的に活用する
5. 専門用語は分かりやすく説明する`;

// サニタイズ関数（シンプル版）
function stripHeadingsAndBullets(text) {
  const lines = text.split(/\r?\n/);
  const patterns = [
    /^Q\d+\s*[:：]/,           // Q1: Q2: など
    /^[#＃].*$/,              // Markdown見出し
    /^[0-9０-９]+\.\s+/,       // 1. 2. などの番号付きリスト
    /^[-–—・]\s+/,            // ハイフンや中点の箇条書き
    /^[①②③④⑤⑥⑦⑧⑨⑩]/,      // 丸数字
    /^[（\\(]\\d+[）\\)]/,       // (1) (2) など
  ];
  
  return lines
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true; // 空行は保持
      return !patterns.some(pattern => pattern.test(trimmed));
    })
    .join('\\n');
}

// JSON → Markdown レンダリング関数
function renderMarkdown(article) {
  const sections = [];
  
  sections.push(`# ${article.title}`);
  sections.push('');
  sections.push(article.lead);
  sections.push('');
  
  for (const section of article.sections) {
    sections.push(`## ${section.h2}`);
    sections.push('');
    sections.push(section.body);
    sections.push('');
  }
  
  if (article.faq && article.faq.length > 0) {
    sections.push('## FAQ');
    sections.push('');
    for (const faq of article.faq) {
      sections.push(`**Q: ${faq.q}**`);
      sections.push('');
      sections.push(`A: ${faq.a}`);
      sections.push('');
    }
  }
  
  if (article.cta) {
    sections.push('## まとめ');
    sections.push('');
    sections.push(article.cta);
    sections.push('');
  }
  
  return sections.join('\\n').trim();
}

// 記事検証関数（品質分析付き）
function validateAndAnalyzeArticle(article) {
  const errors = [];
  const warnings = [];
  let duplicateH2Count = 0;
  let badHeadingsCount = 0;
  let truncationCount = 0;
  
  if (!article.title || typeof article.title !== 'string') {
    errors.push('title is required and must be a string');
  }
  
  if (!article.lead || typeof article.lead !== 'string') {
    errors.push('lead is required and must be a string');
  }
  
  if (!Array.isArray(article.sections)) {
    errors.push('sections must be an array');
  } else if (article.sections.length < 3 || article.sections.length > 5) {
    errors.push(`sections count (${article.sections.length}) must be between 3-5`);
  }
  
  // 詳細分析
  const h2Set = new Set();
  const suspiciousPatterns = [];
  let totalWords = (article.title?.length || 0) + (article.lead?.length || 0);
  
  if (Array.isArray(article.sections)) {
    for (let i = 0; i < article.sections.length; i++) {
      const section = article.sections[i];
      
      if (section.h2) {
        totalWords += section.h2.length;
        const normalizedH2 = section.h2.toLowerCase().trim();
        
        if (h2Set.has(normalizedH2)) {
          duplicateH2Count++;
          errors.push(`Duplicate h2: "${section.h2}"`);
        } else {
          h2Set.add(normalizedH2);
        }
        
        if (section.h2.includes('#') || section.h2.includes('H1:') || section.h2.includes('H2:')) {
          badHeadingsCount++;
          errors.push(`sections[${i}].h2 contains forbidden symbols`);
        }
      }
      
      if (section.body) {
        totalWords += section.body.length;
        
        // body内見出し汚染チェック
        if (section.body.includes('\\n##') || section.body.includes('H2:') || section.body.includes('■')) {
          badHeadingsCount++;
          errors.push(`sections[${i}].body contains heading symbols`);
        }
        
        // 途切れ検出（詳細）
        const truncationPatterns = [
          { pattern: /…で。##/, name: '...で。##' },
          { pattern: /ROIシ##/, name: 'ROIシ##' },
          { pattern: /外注はC##/, name: '外注はC##' },
          { pattern: /AR##/, name: 'AR##' },
          { pattern: /[あ-ん]##$/, name: 'ひらがな##' },
          { pattern: /、##$/, name: '読点##' }
        ];
        
        for (const tp of truncationPatterns) {
          if (tp.pattern.test(section.body)) {
            truncationCount++;
            suspiciousPatterns.push(`Section ${i + 1}: ${tp.name}`);
            errors.push(`sections[${i}].body truncation: ${tp.name}`);
          }
        }
      }
    }
  }
  
  // 品質スコア計算
  let structureScore = 100;
  if (duplicateH2Count > 0) structureScore -= duplicateH2Count * 25;
  if (badHeadingsCount > 0) structureScore -= badHeadingsCount * 30;
  if (truncationCount > 0) structureScore -= truncationCount * 40;
  structureScore = Math.max(0, structureScore);
  
  const contentRichness = Math.min(100, Math.floor(totalWords / 30)); // 簡易計算
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      titleLength: article.title?.length || 0,
      leadLength: article.lead?.length || 0,
      sectionCount: Array.isArray(article.sections) ? article.sections.length : 0,
      totalWords,
      duplicateH2Count,
      badHeadingsCount,
      truncationCount,
      structureScore,
      contentRichness
    },
    suspiciousPatterns
  };
}

async function testGPT5MiniStructured() {
  try {
    console.log('=== Bパス構造ガード版: gpt-5-mini テスト開始 ===');
    
    const testData = fs.readFileSync('./test-very-long-answers.txt', 'utf-8');
    console.log('テストデータ文字数:', testData.length);
    console.log('モデル: gpt-5-mini');
    
    // 入力サニタイズ
    const sanitizedContext = stripHeadingsAndBullets(testData);
    console.log('サニタイズ後文字数:', sanitizedContext.length);
    
    console.log('\\n1. 構造ガード記事生成テスト...');
    
    // Bパス用ペイロード構築
    const payload = {
      theme: 'スタートアップ資金調達の成功戦略',
      blocks: [
        { question: '資金調達の準備段階', body: sanitizedContext.substring(0, 900), hasEvidence: true },
        { question: '投資家との交渉戦略', body: sanitizedContext.substring(900, 1800), hasEvidence: true },
        { question: '調達後の成長戦略', body: sanitizedContext.substring(1800, 2700), hasEvidence: true },
        { question: 'よくある失敗パターン', body: sanitizedContext.substring(2700, 3600), hasEvidence: true }
      ],
      context: sanitizedContext,
      options: { maxSections: 4, tone: 'professional', targetLength: 3500 }
    };

    const completion = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: STRUCTURED_ARTICLE_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `次の素材から、構造化記事(JSON)を出力してください：\\n\\n${JSON.stringify(payload, null, 2)}`
        }
      ],
      max_output_tokens: 16000,
    });

    console.log('\\n=== gpt-5-mini 構造ガード応答詳細 ===');
    console.log('Status:', completion.status);
    console.log('Total tokens:', completion.usage?.total_tokens);
    console.log('Input tokens:', completion.usage?.input_tokens);
    console.log('Output tokens:', completion.usage?.output_tokens);
    console.log('Reasoning tokens:', completion.usage?.output_tokens_details?.reasoning_tokens || 0);
    
    // JSON解析
    let article;
    try {
      const rawResponse = completion.output_text || '';
      article = JSON.parse(rawResponse);
      console.log('✅ JSON解析成功');
    } catch (parseError) {
      console.error('❌ JSON解析失敗:', parseError.message);
      throw new Error('JSON解析失敗');
    }
    
    // 構造検証・品質分析
    const analysis = validateAndAnalyzeArticle(article);
    
    console.log('\\n📊 構造ガード分析結果:');
    console.log('- sections:', analysis.stats.sectionCount);
    console.log('- duplicateH2:', analysis.stats.duplicateH2Count);
    console.log('- badHeadings:', analysis.stats.badHeadingsCount);
    console.log('- truncations:', analysis.stats.truncationCount);
    console.log('- structureScore:', analysis.stats.structureScore);
    console.log('- contentRichness:', analysis.stats.contentRichness);
    console.log('- 合格:', analysis.isValid ? '✅' : '❌');
    
    if (analysis.suspiciousPatterns.length > 0) {
      console.log('\\n🚨 異常パターン検出:');
      analysis.suspiciousPatterns.forEach(pattern => console.log(`  - ${pattern}`));
    }
    
    if (!analysis.isValid) {
      console.log('\\n🚨 検証エラー:');
      analysis.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Markdown レンダリング
    const markdown = renderMarkdown(article);
    fs.writeFileSync('./test-gpt5mini-800-1000-structured-article.md', markdown);
    console.log('\\n💾 構造化記事を test-gpt5mini-800-1000-structured-article.md に保存');
    
    // 従来版との比較（ファイルが存在する場合）
    let comparison = {};
    try {
      const legacyArticle = fs.readFileSync('./test-gpt5mini-800-1000-article.md', 'utf-8');
      comparison = {
        legacy_length: legacyArticle.length,
        structured_length: markdown.length,
        legacy_h1: (legacyArticle.match(/^# /gm) || []).length,
        legacy_h2: (legacyArticle.match(/^## /gm) || []).length,
        structured_h1: (markdown.match(/^# /gm) || []).length,
        structured_h2: (markdown.match(/^## /gm) || []).length,
        legacy_issues: [
          { pattern: /…で。##/, name: '途切れ1' },
          { pattern: /ROIシ##/, name: '途切れ2' },
          { pattern: /外注はC##/, name: '途切れ3' },
          { pattern: /H[1-6]:/, name: '見出し混入' }
        ].filter(p => p.pattern.test(legacyArticle)).length,
        structured_issues: analysis.suspiciousPatterns.length
      };
      
      console.log('\\n📊 従来版との比較:');
      console.log(`- 従来版記事: ${comparison.legacy_length}文字, H2: ${comparison.legacy_h2}個, 異常: ${comparison.legacy_issues}件`);
      console.log(`- 構造ガード版: ${comparison.structured_length}文字, H2: ${comparison.structured_h2}個, 異常: ${comparison.structured_issues}件`);
      console.log(`- 改善効果: 異常パターン ${comparison.legacy_issues} → ${comparison.structured_issues} (${comparison.legacy_issues - comparison.structured_issues >= 0 ? '✅' : '❌'})`);
    } catch (e) {
      console.log('\\n📊 比較データなし（従来版ファイル未生成）');
    }
    
    // 最終レポート
    console.log('\\n📝 最終レポート:');
    console.log(`Bパス: JSON I/O化完了 / sections=${analysis.stats.sectionCount} / duplicateH2=${analysis.stats.duplicateH2Count} / badHeadings=${analysis.stats.badHeadingsCount} / truncations=${analysis.stats.truncationCount} / size=${markdown.length}chars`);
    console.log(`Renderer: Markdown出力 saved → ./test-gpt5mini-800-1000-structured-article.md`);
    console.log(`品質スコア: 構造${analysis.stats.structureScore}/100, 内容充実度${analysis.stats.contentRichness}/100`);
    
    return {
      success: analysis.isValid,
      articleLength: markdown.length,
      analysis: analysis,
      comparison: comparison,
      inputLength: testData.length,
      tokenUsage: completion.usage
    };
    
  } catch (error) {
    console.error('❌ 構造ガードテストエラー:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      status: error?.status
    });
    throw error;
  }
}

// 実行部分
async function runGPT5MiniStructuredTest() {
  console.log('🔍 Bパス構造ガード: gpt-5-mini 記事生成システムテスト');
  
  try {
    const result = await testGPT5MiniStructured();
    
    console.log('\\n\\n🎉 gpt-5-mini 構造ガードテスト完了');
    console.log('生成結果:', result.success ? '✅ 合格' : '❌ 不合格');
    
    if (result.success && result.analysis.stats.structureScore >= 80) {
      console.log('\\n✅ 結論: Bパス構造ガード正常動作（gpt-5-mini）');
      console.log(`📊 生成記事: ${result.articleLength}文字`);
      console.log(`📊 構造スコア: ${result.analysis.stats.structureScore}/100`);
      console.log(`📊 異常パターン: ${result.analysis.suspiciousPatterns.length}件`);
      
      if (result.comparison.legacy_issues !== undefined) {
        const improvement = result.comparison.legacy_issues - result.comparison.structured_issues;
        console.log(`📊 改善効果: ${improvement >= 0 ? '+' : ''}${improvement}件の異常パターン削減`);
      }
    } else {
      console.log('\\n⚠️ 構造ガード不具合または品質不足');
      console.log('エラー詳細:', result.analysis.errors);
      console.log(`構造スコア: ${result.analysis.stats.structureScore}/100 (80点未満)`);
    }
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
    process.exit(1);
  }
}

runGPT5MiniStructuredTest();