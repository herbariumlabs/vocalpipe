export interface UserLanguageSettings {
    input: "hindi" | "english" | "assamese";
    output: "hindi" | "english" | "assamese";
}

export interface BhashiniASRRequest {
    pipelineTasks: Array<{
        taskType: "asr";
        config: {
            language: { sourceLanguage: string };
            serviceId: string;
            preProcessors: string[];
            postProcessors: string[];
        };
    }>;
    inputData: {
        input: Array<{ source: string }>;
        audio: Array<{ audioContent: string }>;
    };
}

export interface BhashiniTranslationRequest {
    pipelineTasks: Array<{
        taskType: "translation";
        config: {
            language: {
                sourceLanguage: string;
                targetLanguage: string;
                sourceScriptCode: string;
                targetScriptCode: string;
            };
            serviceId: string;
        };
    }>;
    inputData: {
        input: Array<{ source: string }>;
        audio: any[];
    };
}

export interface BhashiniTTSRequest {
    pipelineTasks: Array<{
        taskType: "tts";
        config: {
            language: { sourceLanguage: string };
            serviceId: string;
            gender: string;
            preProcessors: string[];
            postProcessors: string[];
        };
    }>;
    inputData: {
        input: Array<{ source: string }>;
        audio: Array<{ audioContent: string }>;
    };
}

export interface BhashiniResponse {
    pipelineResponse: Array<{
        taskType: string;
        config: any;
        output?: Array<{ source?: string; target?: string }>;
        audio?: Array<{ audioContent: string }>;
    }>;
}

export interface ProcessingResult {
    inputText: string;
    outputText: string;
    audioBase64: string;
}

export type InputType = "text" | "voice";
export type Language = "hindi" | "english" | "assamese";

export interface AppConfig {
    telegramBotToken: string;
    openaiApiKey: string;
    nodeEnv: string;
    port: number;
    tempDir: string;
    logLevel: string;
}
