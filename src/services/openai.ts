import { OpenAI } from "openai";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { config } from "../config";
import { RAGService } from "./rag";

export class OpenAIService {
    private client: OpenAI;
    private chatModel: ChatOpenAI;
    private ragService: RAGService;

    constructor() {
        this.client = new OpenAI({ apiKey: config.openaiApiKey });
        this.chatModel = new ChatOpenAI({
            model: "gpt-4o-mini",
            apiKey: config.openaiApiKey,
            temperature: 0.7,
        });
        this.ragService = new RAGService();
    }

    async initialize(): Promise<void> {
        await this.ragService.initialize();
    }

    async generateResponse(prompt: string): Promise<{
        response: string;
        ragContext: {
            documentsFound: number;
            hasRAGContext: boolean;
        };
    }> {
        try {
            // Step 1: Search for relevant documents using RAG
            const relevantDocs = await this.ragService.searchDocuments(
                prompt,
                3
            );

            let systemPrompt: string;
            let context = "";

            if (relevantDocs.length > 0) {
                // If we found relevant documents, use them as context
                context = relevantDocs
                    .map(
                        (doc, index) =>
                            `[Document ${index + 1} - ${doc.metadata.source}]\n${doc.content}`
                    )
                    .join("\n\n");

                systemPrompt = `You are a helpful AI assistant. Please provide clear, natural responses without using exclamation marks (!) in your text. This is important for text-to-speech pronunciation accuracy, as exclamation marks can be mispronounced as "factorial" by TTS systems. Use periods, commas, and other punctuation as needed, but avoid exclamation marks entirely.

Based on the following documents, please answer the user's question. If the documents contain relevant information, prioritize that information in your response and cite the sources. If the documents don't fully answer the question, you may supplement with your general knowledge, but clearly indicate when you're doing so.

RELEVANT DOCUMENTS:
${context}

Please answer based on the above documents when possible, and cite your sources by mentioning the document names.`;

                console.log(
                    `📖 Using RAG context from ${relevantDocs.length} documents`
                );
            } else {
                // No relevant documents found, use general knowledge
                systemPrompt = `You are a helpful AI assistant. Please provide clear, natural responses without using exclamation marks (!) in your text. This is important for text-to-speech pronunciation accuracy, as exclamation marks can be mispronounced as "factorial" by TTS systems. Use periods, commas, and other punctuation as needed, but avoid exclamation marks entirely.

No relevant documents were found in the knowledge base for this query, so please answer using your general knowledge.`;

                console.log(
                    "🧠 No relevant documents found, using general knowledge"
                );
            }

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

            return {
                response: cleanedResponse,
                ragContext: {
                    documentsFound: relevantDocs.length,
                    hasRAGContext: relevantDocs.length > 0,
                },
            };
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

    // Method to add documents to the RAG system
    async addDocument(content: string, source: string): Promise<void> {
        await this.ragService.addDocument(content, source);
    }

    // Method to get RAG system statistics
    getRAGStats(): { totalDocuments: number; totalChunks: number } {
        return this.ragService.getDocumentStats();
    }
}
