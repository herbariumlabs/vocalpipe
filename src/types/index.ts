export interface UserLanguageSettings {
    input: "hindi" | "english" | "assamese" | "punjabi";
    output: "hindi" | "english" | "assamese" | "punjabi";
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
    ragContext?: {
        documentsFound: number;
        hasRAGContext: boolean;
        relevantChunks?: number;
        searchTimeMs?: number;
        topDocuments?: any[];
        relevanceScores?: number[];
    };
    processingTimeMs: number;
    totalTokensUsed?: number;
    aiModel?: string;
    messageId?: string;
    responseId?: string;
}

export type InputType = "text" | "voice";
export type Language = "hindi" | "english" | "assamese" | "punjabi";

// Database-related interfaces
export interface DatabaseUserEvent {
    userId: number;
    telegramUserId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    sessionId?: string;
    conversationId?: string;
}

export interface MessageLogData extends DatabaseUserEvent {
    inputType: InputType;
    originalText?: string;
    processedText?: string;
    audioFileId?: string;
    inputLanguage: Language;
    messageLength: number;
    processingTimeMs?: number;
}

export interface ResponseLogData extends DatabaseUserEvent {
    messageId: string;
    responseText: string;
    translatedText?: string;
    audioBase64?: string;
    outputLanguage: Language;
    hasRAGContext: boolean;
    ragDocumentsFound: number;
    processingTimeMs: number;
    totalTokensUsed?: number;
    aiModel?: string;
}

export interface LanguageChangeLogData extends DatabaseUserEvent {
    changeType: "input" | "output" | "both";
    previousInputLanguage?: Language;
    previousOutputLanguage?: Language;
    newInputLanguage?: Language;
    newOutputLanguage?: Language;
    triggeredBy?: string;
}

export interface RAGQueryLogData extends DatabaseUserEvent {
    messageId: string;
    query: string;
    documentsFound: number;
    relevantChunks: number;
    hasResults: boolean;
    searchTimeMs?: number;
    topDocuments?: any;
    relevanceScores?: any;
}

export interface ErrorLogData {
    userId?: number;
    errorType: string;
    errorMessage: string;
    errorContext?: string;
    stackTrace?: string;
    additionalData?: any;
}

export interface AnalyticsEventLogData extends DatabaseUserEvent {
    eventType: string;
    eventData?: any;
    callbackData?: string;
    platform?: string;
}

export interface AppConfig {
    telegramBotToken: string;
    openaiApiKey: string;
    nodeEnv: string;
    port: number;
    tempDir: string;
    logLevel: string;
    posthogApiKey?: string;
    posthogHost?: string;
    databaseUrl?: string;
    sentryDsn?: string;
    sentryEnvironment?: string;
    sentryEnableProfiling?: boolean;
    sentryTracesSampleRate?: number;
    sentryProfilesSampleRate?: number;
}
