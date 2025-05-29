import { writeFileSync } from "fs";
import fetch from "node-fetch";
import { BhashiniService } from "./bhashini";
import { OpenAIService } from "./openai";
import { UserStateService } from "./userState";
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
    constructor(
        private bhashiniService: BhashiniService,
        private openaiService: OpenAIService,
        private userStateService: UserStateService
    ) {}

    async processVoiceMessage(
        userId: number,
        fileLink: string
    ): Promise<ProcessingResult> {
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
            const recognizedText = await this.bhashiniService.speechToText(
                audioBase64,
                settings.input
            );

            console.log(
                `🗣 ${settings.input.toUpperCase()} STT:`,
                recognizedText
            );

            // Process through the same pipeline as text
            return await this.processTextInput(userId, recognizedText);
        } finally {
            cleanupFiles([ogaPath, wavPath]);
        }
    }

    async processTextInput(
        userId: number,
        inputText: string
    ): Promise<ProcessingResult> {
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
        } else {
            englishPrompt = inputText;
            console.log("🔁 EN Prompt:", englishPrompt);
        }

        // Step 2: Get GPT response
        const gptReply =
            await this.openaiService.generateResponse(englishPrompt);
        console.log("🤖 GPT Output:", gptReply);

        // Step 3: Translate and generate speech based on output language
        let finalText: string;
        let audioBase64: string;

        if (settings.output === "hindi") {
            finalText = await this.bhashiniService.translateText(
                gptReply,
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
                gptReply,
                "english",
                "assamese"
            );
            console.log("📝 Assamese Output:", finalText);
            audioBase64 = await this.bhashiniService.textToSpeech(
                finalText,
                "assamese"
            );
        } else {
            finalText = gptReply;
            console.log("📝 English Output:", finalText);
            audioBase64 = await this.openaiService.textToSpeech(finalText);
        }

        return {
            inputText,
            outputText: finalText,
            audioBase64,
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
}
