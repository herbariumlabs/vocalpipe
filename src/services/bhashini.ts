import fetch from "node-fetch";
import {
    BhashiniASRRequest,
    BhashiniTranslationRequest,
    BhashiniTTSRequest,
    BhashiniResponse,
    Language,
} from "../types";

const BHASHINI_API_URL = "https://anuvaad-backend.bhashini.co.in/v1/pipeline";

export class BhashiniService {
    private getLanguageCode(language: Language): string {
        switch (language) {
            case "hindi":
                return "hi";
            case "assamese":
                return "as";
            case "punjabi":
                return "pa";
            case "english":
                return "en";
            default:
                return "en";
        }
    }

    private getScriptCode(language: Language): string {
        switch (language) {
            case "hindi":
                return "Deva";
            case "assamese":
                return "Beng";
            case "punjabi":
                return "Guru";
            case "english":
                return "Latn";
            default:
                return "Latn";
        }
    }

    private getTTSServiceId(language: Language): string {
        switch (language) {
            case "hindi":
                return "Bhashini/IITM/TTS";
            case "assamese":
                return "Bhashini/IITM/TTS"; // Using same service for Assamese
            case "punjabi":
                return "Bhashini/IITM/TTS"; // Using same service for Punjabi
            case "english":
                return "Bhashini/IITM/TTS"; // Fallback to Hindi TTS for English
            default:
                return "Bhashini/IITM/TTS";
        }
    }
    async speechToText(
        audioBase64: string,
        language: Language
    ): Promise<string> {
        let serviceId: string;
        let sourceLanguage: string;

        switch (language) {
            case "hindi":
                serviceId = "ai4bharat/conformer-hi-gpu--t4";
                sourceLanguage = "hi";
                break;
            case "assamese":
                serviceId = "bhashini/ai4bharat/conformer-multilingual-asr";
                sourceLanguage = "as";
                break;
            case "punjabi":
                serviceId =
                    "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4";
                sourceLanguage = "pa";
                break;
            case "english":
            default:
                serviceId = "ai4bharat/whisper-medium-en--gpu--t4";
                sourceLanguage = "en";
                break;
        }

        const request: BhashiniASRRequest = {
            pipelineTasks: [
                {
                    taskType: "asr",
                    config: {
                        language: { sourceLanguage },
                        serviceId,
                        preProcessors: [],
                        postProcessors: ["itn"],
                    },
                },
            ],
            inputData: {
                input: [{ source: "" }],
                audio: [{ audioContent: audioBase64 }],
            },
        };

        const response = await fetch(BHASHINI_API_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request),
        });

        const result = (await response.json()) as BhashiniResponse;

        if (!result.pipelineResponse?.[0]?.output?.[0]?.source) {
            throw new Error("Invalid ASR response structure");
        }

        return result.pipelineResponse[0].output[0].source;
    }

    async translateText(
        text: string,
        from: Language,
        to: Language
    ): Promise<string> {
        if (from === to) return text;

        const request: BhashiniTranslationRequest = {
            pipelineTasks: [
                {
                    taskType: "translation",
                    config: {
                        language: {
                            sourceLanguage: this.getLanguageCode(from),
                            targetLanguage: this.getLanguageCode(to),
                            sourceScriptCode: this.getScriptCode(from),
                            targetScriptCode: this.getScriptCode(to),
                        },
                        serviceId: "ai4bharat/indictrans-v2-all-gpu--t4",
                    },
                },
            ],
            inputData: {
                input: [{ source: text }],
                audio: [],
            },
        };

        const response = await fetch(BHASHINI_API_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request),
        });

        const result = (await response.json()) as BhashiniResponse;

        if (!result.pipelineResponse?.[0]?.output?.[0]?.target) {
            throw new Error("Invalid translation response structure");
        }

        return result.pipelineResponse[0].output[0].target;
    }

    async textToSpeech(
        text: string,
        language: Language = "hindi"
    ): Promise<string> {
        const request: BhashiniTTSRequest = {
            pipelineTasks: [
                {
                    taskType: "tts",
                    config: {
                        language: {
                            sourceLanguage: this.getLanguageCode(language),
                        },
                        serviceId: this.getTTSServiceId(language),
                        gender: "female",
                        preProcessors: [],
                        postProcessors: [],
                    },
                },
            ],
            inputData: {
                input: [{ source: text }],
                audio: [{ audioContent: "" }],
            },
        };

        const response = await fetch(BHASHINI_API_URL, {
            method: "POST",
            headers: {
                Accept: "application/json, text/plain, */*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        });

        const result = (await response.json()) as BhashiniResponse;

        if (!result.pipelineResponse?.[0]?.audio?.[0]?.audioContent) {
            console.error(
                `❌ ${language.charAt(0).toUpperCase() + language.slice(1)} TTS API Response:`,
                JSON.stringify(result, null, 2)
            );
            throw new Error(`Invalid ${language} TTS API response structure`);
        }

        return result.pipelineResponse[0].audio[0].audioContent;
    }
}
