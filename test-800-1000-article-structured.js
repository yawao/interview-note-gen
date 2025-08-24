// Bパス構造ガード版: 800-1000文字記事生成テスト
// JSON I/O + 検証 + サニタイズによる崩れ防止システム
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Bパス構造ガード用のプロンプト定義
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

const STRUCTURED_ARTICLE_USER_PROMPT = `次の素材から、上記スキーマに従う構造化記事(JSON)を出力してください。
素材の長い回答から要点を抽出し、読者に価値を提供する記事に再構成してください。

出力は以下JSONスキーマに厳密準拠：

{
  "type": "object",
  "properties": {
    "title": {"type": "string", "minLength": 10, "maxLength": 60},
    "lead": {"type": "string", "minLength": 50, "maxLength": 300},
    "sections": {
      "type": "array",
      "minItems": 3,
      "maxItems": 5,
      "items": {
        "type": "object", 
        "properties": {
          "h2": {"type": "string", "minLength": 5, "maxLength": 50},
          "body": {"type": "string", "minLength": 200, "maxLength": 800}
        },
        "required": ["h2", "body"]
      }
    },
    "faq": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "q": {"type": "string"},
          "a": {"type": "string"}
        },
        "required": ["q", "a"]
      }
    },
    "cta": {"type": "string"}
  },
  "required": ["title", "lead", "sections"]
}

PROCESSING RULES:
1. blocksでhasEvidence=falseの項目は「この点は未回答でした」等で処理
2. blocksでhasEvidence=trueの項目を中心に各セクションを構成
3. contextは補助情報として参照可能（主役はblocks）
4. 読者にとって実践的で価値のある内容に再構成
5. 長い回答は要点を抽出して構造化

品質要件:
- 各セクションは独立して価値がある内容
- 見出しは読者が一目で内容を理解できる表現
- 具体例・数字・データを含める（可能な場合）
- 読みやすく、actionableな内容にする

入力データ：`;

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
  
  // H1 タイトル
  sections.push(`# ${article.title}`);
  sections.push('');
  
  // リード文
  sections.push(article.lead);
  sections.push('');
  
  // メインセクション
  for (const section of article.sections) {
    sections.push(`## ${section.h2}`);
    sections.push('');
    sections.push(section.body);
    sections.push('');
  }
  
  // FAQ（オプション）
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
  
  // CTA（オプション）
  if (article.cta) {
    sections.push('## まとめ');
    sections.push('');
    sections.push(article.cta);
    sections.push('');
  }
  
  return sections.join('\\n').trim();
}

// 記事検証関数
function validateArticleStructure(article) {
  const errors = [];
  const warnings = [];
  let duplicateH2Count = 0;
  let badHeadingsCount = 0;
  
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
  
  // H2重複チェック
  const h2Set = new Set();
  if (Array.isArray(article.sections)) {
    for (let i = 0; i < article.sections.length; i++) {
      const section = article.sections[i];
      if (section.h2) {
        const normalizedH2 = section.h2.toLowerCase().trim();
        if (h2Set.has(normalizedH2)) {
          errors.push(`Duplicate h2 found: "${section.h2}"`);
          duplicateH2Count++;
        } else {
          h2Set.add(normalizedH2);
        }
        
        // 見出し汚染チェック
        if (section.h2.includes('#') || section.h2.includes('H1:') || section.h2.includes('H2:')) {
          errors.push(`sections[${i}].h2 contains forbidden heading symbols`);
          badHeadingsCount++;
        }
      }
      
      if (section.body) {
        // body内見出し汚染チェック
        if (section.body.includes('\\n##') || section.body.includes('\\n#') || 
            section.body.includes('H2:') || section.body.includes('■')) {
          errors.push(`sections[${i}].body contains forbidden heading symbols`);
          badHeadingsCount++;
        }
        
        // 途切れ検出
        const truncationPatterns = [
          /…で。##/,
          /ROIシ##/,
          /外注はC##/,
          /AR##/,
        ];
        
        for (const pattern of truncationPatterns) {
          if (pattern.test(section.body)) {
            errors.push(`sections[${i}].body appears to be truncated`);
          }
        }
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      titleLength: article.title?.length || 0,
      leadLength: article.lead?.length || 0,
      sectionCount: Array.isArray(article.sections) ? article.sections.length : 0,
      duplicateH2Count,
      badHeadingsCount
    }
  };
}

async function testStructuredArticleGeneration() {
  try {
    console.log('=== Bパス構造ガード版: 記事生成テスト開始 ===');
    
    const testData = fs.readFileSync('./test-very-long-answers.txt', 'utf-8');
    console.log('テストデータ文字数:', testData.length);
    
    // 入力データのサニタイズ（Aパス同様）
    const sanitizedContext = stripHeadingsAndBullets(testData);
    console.log('サニタイズ後文字数:', sanitizedContext.length);
    
    console.log('\\n1. JSON I/O構造ガード記事生成テスト...');
    
    // Bパス用ペイロード構築
    const payload = {
      theme: 'スタートアップ資金調達の成功戦略',
      blocks: [
        { question: '資金調達の準備段階', body: sanitizedContext.substring(0, 800), hasEvidence: true },
        { question: '投資家との交渉', body: sanitizedContext.substring(800, 1600), hasEvidence: true },
        { question: '調達後の戦略', body: sanitizedContext.substring(1600, 2400), hasEvidence: true },
        { question: '失敗要因の分析', body: sanitizedContext.substring(2400, 3200), hasEvidence: true }
      ],
      context: sanitizedContext,
      options: { maxSections: 4, tone: 'professional', targetLength: 3000 }
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
          content: `${STRUCTURED_ARTICLE_USER_PROMPT}\\n\\n${JSON.stringify(payload, null, 2)}`
        }
      ],
      max_output_tokens: 16000,
    });

    console.log('\\n=== 応答詳細 ===');
    console.log('Status:', completion.status);
    console.log('Total tokens:', completion.usage?.total_tokens);
    console.log('Input tokens:', completion.usage?.input_tokens);
    console.log('Output tokens:', completion.usage?.output_tokens);
    
    // JSON パース
    let article;
    try {
      const rawResponse = completion.output_text || '';
      article = JSON.parse(rawResponse);
      console.log('✅ JSON解析成功');
    } catch (parseError) {
      console.error('❌ JSON解析失敗:', parseError.message);
      throw new Error('JSON解析失敗');
    }
    
    // 構造検証
    const validation = validateArticleStructure(article);
    console.log('\\n📊 構造検証結果:');
    console.log('- sections:', validation.stats.sectionCount);
    console.log('- duplicateH2:', validation.stats.duplicateH2Count);
    console.log('- badHeadings:', validation.stats.badHeadingsCount);
    console.log('- 合格:', validation.isValid ? '✅' : '❌');
    
    if (!validation.isValid) {
      console.log('\\n🚨 検証エラー:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Markdown レンダリング
    const markdown = renderMarkdown(article);
    
    // ファイル保存
    fs.writeFileSync('./test-800-1000-structured-article.md', markdown);
    console.log('\\n💾 構造化記事を test-800-1000-structured-article.md に保存');
    
    // 最終分析
    const h1Count = (markdown.match(/^# /gm) || []).length;
    const h2Count = (markdown.match(/^## /gm) || []).length;
    const suspiciousPatterns = [
      { pattern: /…で。##/, name: '途切れ1' },
      { pattern: /ROIシ##/, name: '途切れ2' },
      { pattern: /外注はC##/, name: '途切れ3' },
      { pattern: /AR##/, name: '途切れ4' },
      { pattern: /H[1-6]:/, name: '見出し混入' }
    ];
    
    const foundIssues = suspiciousPatterns.filter(p => p.pattern.test(markdown));
    
    console.log('\\n📝 最終レポート:');
    console.log(`Bパス: JSON I/O化完了 / sections=${validation.stats.sectionCount} / duplicateH2=${validation.stats.duplicateH2Count} / badHeadings=${validation.stats.badHeadingsCount} / size=${markdown.length}chars`);
    console.log(`Renderer: Markdown出力 saved → ./test-800-1000-structured-article.md`);
    console.log(`異常パターン検出: ${foundIssues.length}件`, foundIssues.map(f => f.name));
    
    return {
      success: validation.isValid,
      articleLength: markdown.length,
      validation: validation,
      issues: foundIssues,
      inputLength: testData.length,
      tokenUsage: completion.usage
    };
    
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

// 実行部分
async function runStructuredTest() {
  console.log('🔍 Bパス構造ガード: 800-1000文字記事生成システムテスト');
  
  try {
    const result = await testStructuredArticleGeneration();
    
    console.log('\\n\\n🎉 構造ガードテスト完了');
    console.log('生成結果:', result.success ? '✅ 合格' : '❌ 不合格');
    
    if (result.success) {
      console.log('\\n✅ 結論: Bパス構造ガード正常動作');
      console.log(`📊 生成記事: ${result.articleLength}文字`);
      console.log(`📊 入力データ: ${result.inputLength}文字`);
      console.log(`📊 異常パターン: ${result.issues.length}件`);
    } else {
      console.log('\\n⚠️ 構造ガード不具合: 追加の修正が必要');
      console.log('エラー内容:', result.validation.errors);
    }
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
    process.exit(1);
  }
}

runStructuredTest();