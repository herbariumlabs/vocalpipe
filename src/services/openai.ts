import { OpenAI } from "openai";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { config } from "../config";

export class OpenAIService {
    private client: OpenAI;
    private chatModel: ChatOpenAI;

    constructor() {
        this.client = new OpenAI({ apiKey: config.openaiApiKey });
        this.chatModel = new ChatOpenAI({
            model: "gpt-4o-mini",
            apiKey: config.openaiApiKey,
            temperature: 0.7,
        });
    }

    async generateResponse(prompt: string): Promise<string> {
        try {
            // System prompt to instruct the LLM to avoid exclamation marks for TTS compatibility
            const systemPrompt = `You are a helpful AI assistant. Please provide clear, natural responses without using exclamation marks (!) in your text. This is important for text-to-speech pronunciation accuracy, as exclamation marks can be mispronounced as "factorial" by TTS systems. Use periods, commas, and other punctuation as needed, but avoid exclamation marks entirely.`;

            const messages = [
                new SystemMessage(systemPrompt),
                new HumanMessage(prompt),
            ];

            const response = await this.chatModel.invoke(messages);

            if (!response.content) {
                throw new Error("Invalid LangChain OpenAI response");
            }

            // Additional safety check to remove any exclamation marks that might have slipped through
            const cleanedResponse = response.content
                .toString()
                .replace(/!/g, ".");

            return cleanedResponse;
        } catch (error) {
            console.error("❌ LangChain OpenAI Error:", error);
            throw new Error("Failed to generate AI response");
        }
    }

    async textToSpeech(text: string): Promise<string> {
        try {
            const response = await this.client.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: text,
                response_format: "wav",
            });

            const buffer = Buffer.from(await response.arrayBuffer());
            return buffer.toString("base64");
        } catch (error) {
            console.error("❌ English TTS Error:", error);
            throw new Error("Failed to generate English speech");
        }
    }
}
