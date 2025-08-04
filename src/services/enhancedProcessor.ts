import { writeFileSync } from "fs";
import fetch from "node-fetch";
import { BhashiniService } from "./bhashini";
import { OpenAIService } from "./openai";
import { UserStateService } from "./userState";
import { EnhancedAnalyticsService } from "./enhancedAnalytics";
import { databaseService, InputType as DBInputType } from "./database";
import {
    convertOgaToWav,
    convertWavToOgg,
    saveBase64ToWav,
    readFileAsBase64,
} from "../utils/audio";
import {
    generateUniqueId,
    generateFilePaths,
    cleanupFiles,
} from "../utils/file";
import {
    InputType,
    ProcessingResult,
    UserLanguageSettings,
    MessageLogData,
    ResponseLogData,
    RAGQueryLogData,
    DatabaseUserEvent,
} from "../types";

export class EnhancedProcessorService {
    private initialized = false;

    constructor(
        private bhashiniService: BhashiniService,
        private openaiService: OpenAIService,
        private userStateService: UserStateService,
        private analyticsService: EnhancedAnalyticsService
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log("🔄 Initializing Enhanced ProcessorService with RAG...");
        await this.openaiService.initialize();
        this.initialized = true;

        // Log RAG statistics
        const stats = this.openaiService.getRAGStats();
        console.log(
            `📊 RAG Stats: ${stats.totalDocuments} documents, ${stats.totalChunks} chunks`
        );
    }

    async processVoiceMessage(
        userId: number,
        fileLink: string,
        ctx?: any
    ): Promise<ProcessingResult> {
        await this.initialize();

        const settings = this.userStateService.getUserSettings(userId);
        const uid = generateUniqueId();
        const { ogaPath, wavPath } = generateFilePaths(uid);

        const startTime = Date.now();
        let messageId: string | null = null;
        let responseId: string | null = null;
        let dbUserEvent: DatabaseUserEvent | null = null;

        try {
            // Create database user event for session/conversation tracking
            if (ctx) {
                dbUserEvent =
                    await this.analyticsService.createDatabaseUserEvent(ctx);
            }

            // Download and convert audio
            const response = await fetch(fileLink);
            const buffer = await response.buffer();
            writeFileSync(ogaPath, buffer);

            await convertOgaToWav(ogaPath, wavPath);
            const audioBase64 = readFileAsBase64(wavPath);

            // Speech-to-Text
            const sttStartTime = Date.now();
            const recognizedText = await this.bhashiniService.speechToText(
                audioBase64,
                settings.input
            );
            const sttTime = Date.now() - sttStartTime;

            console.log(
                `🗣 ${settings.input.toUpperCase()} STT:`,
                recognizedText
            );

            // Log the voice message to database
            if (dbUserEvent) {
                messageId = await this.analyticsService.logMessage({
                    ...dbUserEvent,
                    inputType: "voice",
                    originalText: recognizedText,
                    processedText: recognizedText,
                    audioFileId: fileLink,
                    inputLanguage: settings.input,
                    messageLength: recognizedText.length,
                    processingTimeMs: sttTime,
                });
            }

            // Process through the same pipeline as text
            const result = await this.processTextInput(
                userId,
                recognizedText,
                ctx,
                messageId,
                sttTime
            );

            // Track voice-specific analytics
            await this.analyticsService.trackVoiceMessage({
                userId,
                inputType: "voice",
                inputLanguage: settings.input,
                outputLanguage: settings.output,
                messageLength: recognizedText.length,
                hasRAGContext: result.ragContext?.hasRAGContext || false,
                ragDocumentsFound: result.ragContext?.documentsFound || 0,
                processingTimeMs: sttTime + result.processingTimeMs,
            });

            return {
                ...result,
                messageId: messageId || result.messageId,
                processingTimeMs: sttTime + result.processingTimeMs,
            };
        } catch (error) {
            // Log error
            await this.analyticsService.trackError({
                userId,
                errorType: "processing_error",
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                context: "processVoiceMessage",
            });
            throw error;
        } finally {
            cleanupFiles([ogaPath, wavPath]);
        }
    }

    async processTextInput(
        userId: number,
        inputText: string,
        ctx?: any,
        existingMessageId?: string | null,
        priorProcessingTime: number = 0
    ): Promise<ProcessingResult> {
        await this.initialize();

        const settings = this.userStateService.getUserSettings(userId);
        const startTime = Date.now();
        let messageId = existingMessageId;
        let responseId: string | null = null;
        let dbUserEvent: DatabaseUserEvent | null = null;

        try {
            // Create database user event for session/conversation tracking
            if (ctx) {
                dbUserEvent =
                    await this.analyticsService.createDatabaseUserEvent(ctx);
            }

            // Log the text message to database if not already logged
            if (!messageId && dbUserEvent) {
                messageId = await this.analyticsService.logMessage({
                    ...dbUserEvent,
                    inputType: "text",
                    originalText: inputText,
                    processedText: inputText,
                    inputLanguage: settings.input,
                    messageLength: inputText.length,
                });
            }

            // Step 1: Translate to English if needed for GPT
            let englishPrompt: string;
            const translationStartTime = Date.now();

            if (settings.input === "hindi") {
                englishPrompt = await this.bhashiniService.translateText(
                    inputText,
                    "hindi",
                    "english"
                );
                console.log("🔁 Hindi→EN:", inputText, "→", englishPrompt);
            } else if (settings.input === "assamese") {
                englishPrompt = await this.bhashiniService.translateText(
                    inputText,
                    "assamese",
                    "english"
                );
                console.log("🔁 Assamese→EN:", inputText, "→", englishPrompt);
            } else if (settings.input === "punjabi") {
                englishPrompt = await this.bhashiniService.translateText(
                    inputText,
                    "punjabi",
                    "english"
                );
                console.log("🔁 Punjabi→EN:", inputText, "→", englishPrompt);
            } else {
                englishPrompt = inputText;
                console.log("🔁 EN Prompt:", englishPrompt);
            }

            const translationTime = Date.now() - translationStartTime;

            // Step 2: Get GPT response with RAG
            const ragStartTime = Date.now();
            const gptResult =
                await this.openaiService.generateResponse(englishPrompt);
            const ragTime = Date.now() - ragStartTime;

            console.log("🤖 GPT Output:", gptResult.response);
            console.log(
                `📊 RAG Context: ${gptResult.ragContext.documentsFound} docs found, hasRAG: ${gptResult.ragContext.hasRAGContext}`
            );

            // Log RAG query if it was executed
            if (
                gptResult.ragContext.hasRAGContext &&
                messageId &&
                dbUserEvent
            ) {
                await this.analyticsService.trackRAGQuery(
                    {
                        userId,
                        query: englishPrompt,
                        documentsFound: gptResult.ragContext.documentsFound,
                        relevantChunks: 0, // Default value since not available in current gptResult
                        hasResults: gptResult.ragContext.hasRAGContext,
                    },
                    messageId
                );
            }

            // Step 3: Translate and generate speech based on output language
            let finalText: string;
            let audioBase64: string;
            const outputStartTime = Date.now();

            if (settings.output === "hindi") {
                finalText = await this.bhashiniService.translateText(
                    gptResult.response,
                    "english",
                    "hindi"
                );
                console.log("📝 Hindi Output:", finalText);
                audioBase64 = await this.bhashiniService.textToSpeech(
                    finalText,
                    "hindi"
                );
            } else if (settings.output === "assamese") {
                finalText = await this.bhashiniService.translateText(
                    gptResult.response,
                    "english",
                    "assamese"
                );
                console.log("📝 Assamese Output:", finalText);
                audioBase64 = await this.bhashiniService.textToSpeech(
                    finalText,
                    "assamese"
                );
            } else if (settings.output === "punjabi") {
                finalText = await this.bhashiniService.translateText(
                    gptResult.response,
                    "english",
                    "punjabi"
                );
                console.log("📝 Punjabi Output:", finalText);
                audioBase64 = await this.bhashiniService.textToSpeech(
                    finalText,
                    "punjabi"
                );
            } else {
                finalText = gptResult.response;
                console.log("📝 English Output:", finalText);
                audioBase64 = await this.openaiService.textToSpeech(finalText);
            }

            const outputTime = Date.now() - outputStartTime;
            const totalProcessingTime =
                priorProcessingTime + translationTime + ragTime + outputTime;

            // Log the response to database
            if (messageId && dbUserEvent) {
                responseId = await this.analyticsService.logResponse({
                    ...dbUserEvent,
                    messageId,
                    responseText: finalText,
                    translatedText:
                        settings.output !== "english" ? finalText : undefined,
                    audioBase64,
                    outputLanguage: settings.output,
                    hasRAGContext: gptResult.ragContext.hasRAGContext,
                    ragDocumentsFound: gptResult.ragContext.documentsFound,
                    processingTimeMs: totalProcessingTime,
                    totalTokensUsed: undefined, // Not available in current gptResult
                    aiModel: undefined, // Not available in current gptResult
                });

                // Update RAG query with response ID if it exists
                if (gptResult.ragContext.hasRAGContext && responseId) {
                    try {
                        await databaseService.updateRAGQueryWithResponse(
                            messageId,
                            responseId
                        );
                    } catch (error) {
                        console.error(
                            "Error updating RAG query with response:",
                            error
                        );
                    }
                }
            }

            // Track comprehensive analytics
            await this.analyticsService.trackMessageProcessing(
                {
                    userId,
                    inputType: "text",
                    inputLanguage: settings.input,
                    outputLanguage: settings.output,
                    messageLength: inputText.length,
                    hasRAGContext: gptResult.ragContext.hasRAGContext,
                    ragDocumentsFound: gptResult.ragContext.documentsFound,
                    processingTimeMs: totalProcessingTime,
                },
                messageId || undefined,
                responseId || undefined,
                dbUserEvent?.sessionId,
                dbUserEvent?.conversationId
            );

            // Track text-specific analytics
            await this.analyticsService.trackTextMessage({
                userId,
                inputType: "text",
                inputLanguage: settings.input,
                outputLanguage: settings.output,
                messageLength: inputText.length,
                hasRAGContext: gptResult.ragContext.hasRAGContext,
                ragDocumentsFound: gptResult.ragContext.documentsFound,
                processingTimeMs: totalProcessingTime,
            });

            // Log system metrics
            await databaseService.logSystemMetric(
                "processing_time_ms",
                totalProcessingTime,
                "ms",
                {
                    inputType: "text",
                    inputLanguage: settings.input,
                    outputLanguage: settings.output,
                    hasRAGContext: gptResult.ragContext.hasRAGContext,
                    ragDocumentsFound: gptResult.ragContext.documentsFound,
                }
            );

            const result: ProcessingResult = {
                inputText,
                outputText: finalText,
                audioBase64,
                ragContext: {
                    documentsFound: gptResult.ragContext.documentsFound,
                    hasRAGContext: gptResult.ragContext.hasRAGContext,
                    relevantChunks: undefined, // Not available in current gptResult
                    searchTimeMs: undefined, // Not available in current gptResult
                    topDocuments: undefined, // Not available in current gptResult
                    relevanceScores: undefined, // Not available in current gptResult
                },
                processingTimeMs: totalProcessingTime,
                totalTokensUsed: undefined, // Not available in current gptResult
                aiModel: undefined, // Not available in current gptResult
                messageId: messageId || undefined,
                responseId: responseId || undefined,
            };

            return result;
        } catch (error) {
            // Log error with context
            await this.analyticsService.trackError({
                userId,
                errorType: "processing_error",
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                context: "processTextInput",
            });
            throw error;
        }
    }

    async generateAudioFile(audioBase64: string): Promise<string> {
        const uid = generateUniqueId();
        const { wavPath, oggPath } = generateFilePaths(uid);

        try {
            saveBase64ToWav(audioBase64, wavPath);
            await convertWavToOgg(wavPath, oggPath);
            return oggPath;
        } finally {
            cleanupFiles([wavPath]);
        }
    }

    // Method to add documents to the RAG system
    async addDocument(content: string, source: string): Promise<void> {
        await this.openaiService.addDocument(content, source);
    }

    // Method to get RAG system statistics
    getRAGStats(): { totalDocuments: number; totalChunks: number } {
        return this.openaiService.getRAGStats();
    }

    // Database analytics methods
    async getUserStats(telegramUserId: number) {
        return await databaseService.getUserStats(telegramUserId);
    }

    async getLanguageDistribution(days: number = 30) {
        return await databaseService.getLanguageDistribution(days);
    }

    async getSystemPerformanceMetrics(days: number = 7) {
        return await databaseService.getSystemPerformanceMetrics(days);
    }

    async getTopErrors(days: number = 7, limit: number = 10) {
        return await databaseService.getTopErrors(days, limit);
    }
}
