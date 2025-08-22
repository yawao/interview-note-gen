// OpenAI API 最小テストコード
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testGpt5Nano() {
  try {
    console.log('=== Minimal Test for gpt-5-mini ===');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "あなたは日本語で応答するアシスタントです。"
        },
        {
          role: "user", 
          content: "こんにちは。簡単な挨拶をお願いします。"
        }
      ],
      temperature: 1,
      max_completion_tokens: 100,
    });

    console.log('=== Response Details ===');
    console.log('Full response object:', JSON.stringify(completion, null, 2));
    
    return completion;
  } catch (error) {
    console.log('=== Error Details ===');
    console.log('Error type:', typeof error);
    console.log('Error constructor:', error?.constructor?.name);
    console.log('Error message:', error?.message);
    console.log('Error status:', error?.status);
    console.log('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw error;
  }
}

testGpt5Nano().catch(console.error);