import fetch from 'node-fetch';
import {
  BhashiniASRRequest,
  BhashiniTranslationRequest,
  BhashiniTTSRequest,
  BhashiniResponse,
  Language
} from '../types';

const BHASHINI_API_URL = 'https://anuvaad-backend.bhashini.co.in/v1/pipeline';

export class BhashiniService {
  async speechToText(audioBase64: string, language: Language): Promise<string> {
    const serviceId = language === 'hindi' 
      ? 'ai4bharat/conformer-hi-gpu--t4'
      : 'ai4bharat/whisper-medium-en--gpu--t4';

    const request: BhashiniASRRequest = {
      pipelineTasks: [{
        taskType: 'asr',
        config: {
          language: { sourceLanguage: language === 'hindi' ? 'hi' : 'en' },
          serviceId,
          preProcessors: [],
          postProcessors: ['itn'],
        },
      }],
      inputData: {
        input: [{ source: '' }],
        audio: [{ audioContent: audioBase64 }],
      },
    };

    const response = await fetch(BHASHINI_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json() as BhashiniResponse;
    
    if (!result.pipelineResponse?.[0]?.output?.[0]?.source) {
      throw new Error('Invalid ASR response structure');
    }

    return result.pipelineResponse[0].output[0].source;
  }

  async translateText(text: string, from: Language, to: Language): Promise<string> {
    if (from === to) return text;

    const request: BhashiniTranslationRequest = {
      pipelineTasks: [{
        taskType: 'translation',
        config: {
          language: {
            sourceLanguage: from === 'hindi' ? 'hi' : 'en',
            targetLanguage: to === 'hindi' ? 'hi' : 'en',
            sourceScriptCode: from === 'hindi' ? 'Deva' : 'Latn',
            targetScriptCode: to === 'hindi' ? 'Deva' : 'Latn',
          },
          serviceId: 'ai4bharat/indictrans-v2-all-gpu--t4',
        },
      }],
      inputData: {
        input: [{ source: text }],
        audio: [],
      },
    };

    const response = await fetch(BHASHINI_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json() as BhashiniResponse;
    
    if (!result.pipelineResponse?.[0]?.output?.[0]?.target) {
      throw new Error('Invalid translation response structure');
    }

    return result.pipelineResponse[0].output[0].target;
  }

  async textToSpeech(text: string): Promise<string> {
    const request: BhashiniTTSRequest = {
      pipelineTasks: [{
        taskType: 'tts',
        config: {
          language: { sourceLanguage: 'hi' },
          serviceId: 'Bhashini/IITM/TTS',
          gender: 'female',
          preProcessors: [],
          postProcessors: [],
        },
      }],
      inputData: {
        input: [{ source: text }],
        audio: [{ audioContent: '' }],
      },
    };

    const response = await fetch(BHASHINI_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const result = await response.json() as BhashiniResponse;
    
    if (!result.pipelineResponse?.[0]?.audio?.[0]?.audioContent) {
      console.error('❌ Hindi TTS API Response:', JSON.stringify(result, null, 2));
      throw new Error('Invalid Hindi TTS API response structure');
    }

    return result.pipelineResponse[0].audio[0].audioContent;
  }
}
