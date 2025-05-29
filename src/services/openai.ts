import { OpenAI } from 'openai';
import { config } from '../config';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Invalid OpenAI response');
    }

    return response.choices[0].message.content;
  }

  async textToSpeech(text: string): Promise<string> {
    try {
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        response_format: 'wav',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer.toString('base64');
    } catch (error) {
      console.error('❌ English TTS Error:', error);
      throw new Error('Failed to generate English speech');
    }
  }
}
