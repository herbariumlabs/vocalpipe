import { writeFileSync } from "fs";
import fetch from "node-fetch";
import { BhashiniService } from "./bhashini";
import { OpenAIService } from "./openai";
import { UserStateService } from "./userState";
import { AnalyticsService } from "./analytics";
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
import { InputType, ProcessingResult, UserLanguageSettings } from "../types";

export class ProcessorService {
    private initialized = false;

    constructor(
        private bhashiniService: BhashiniService,
        private openaiService: OpenAIService,
        private userStateService: UserStateService,
        private analyticsService: AnalyticsService
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log("🔄 Initializing ProcessorService with RAG...");
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
        fileLink: string
    ): Promise<ProcessingResult> {
        await this.initialize();

        const settings = this.userStateService.getUserSettings(userId);
        const uid = generateUniqueId();
        const { ogaPath, wavPath } = generateFilePaths(uid);

        try {
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

            // Process through the same pipeline as text
            const result = await this.processTextInput(userId, recognizedText);

            // Track voice-specific analytics
            await this.analyticsService.trackVoiceMessage({
                userId,
                inputType: "voice",
                inputLanguage: settings.input,
                outputLanguage: settings.output,
                messageLength: recognizedText.length,
                hasRAGContext: result.ragContext?.hasRAGContext || false,
                ragDocumentsFound: result.ragContext?.documentsFound || 0,
                processingTimeMs: sttTime + (result.ragContext ? 0 : 0), // STT time + processing time
            });

            return result;
        } finally {
            cleanupFiles([ogaPath, wavPath]);
        }
    }

    async processTextInput(
        userId: number,
        inputText: string
    ): Promise<ProcessingResult> {
        await this.initialize();

        const settings = this.userStateService.getUserSettings(userId);

        // Step 1: Translate to English if needed for GPT
        let englishPrompt: string;
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

        // Step 2: Get GPT response with RAG
        const startTime = Date.now();
        const gptResult =
            await this.openaiService.generateResponse(englishPrompt);
        const processingTime = Date.now() - startTime;

        console.log("🤖 GPT Output:", gptResult.response);
        console.log(
            `📊 RAG Context: ${gptResult.ragContext.documentsFound} docs found, hasRAG: ${gptResult.ragContext.hasRAGContext}`
        );

        // Step 3: Translate and generate speech based on output language
        let finalText: string;
        let audioBase64: string;

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

        // Track analytics
        await this.analyticsService.trackMessageProcessing({
            userId,
            inputType: "text",
            inputLanguage: settings.input,
            outputLanguage: settings.output,
            messageLength: inputText.length,
            hasRAGContext: gptResult.ragContext.hasRAGContext,
            ragDocumentsFound: gptResult.ragContext.documentsFound,
            processingTimeMs: processingTime,
        });

        return {
            inputText,
            outputText: finalText,
            audioBase64,
            ragContext: gptResult.ragContext,
            processingTimeMs: processingTime,
            totalTokensUsed: undefined,
            aiModel: undefined,
            messageId: undefined,
            responseId: undefined,
        };
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
}
