// Responses API テスト
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testResponsesAPI() {
  try {
    console.log('=== Testing Responses API ===');
    
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "あなたは日本語で応答するアシスタントです。"
        },
        {
          role: "user", 
          content: "こんにちは。簡単な挨拶をお願いします。"
        }
      ],
      max_output_tokens: 1000,
    });

    console.log('=== Responses API Success ===');
    console.log('Full response:', JSON.stringify(response, null, 2));
    
    return response;
  } catch (error) {
    console.log('=== Responses API Error ===');
    console.log('Error type:', typeof error);
    console.log('Error constructor:', error?.constructor?.name);
    console.log('Error message:', error?.message);
    console.log('Error status:', error?.status);
    console.log('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw error;
  }
}

export default testResponsesAPI;