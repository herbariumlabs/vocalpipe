import { logger } from "./logger";
import { OpenAI } from "openai";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { config } from "../config";
import { RAGService } from "./rag";
import { sentryService } from "./sentry";

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
        logger.info("Initializing OpenAI service");

        return await sentryService.trackOperation(
            "openai.initialize",
            async () => {
                await this.ragService.initialize();

                const stats = this.ragService.getDocumentStats();
                logger.info("OpenAI service initialized", {
                    ragDocuments: stats.totalDocuments,
                    ragChunks: stats.totalChunks,
                });

                sentryService.addBreadcrumb({
                    message: "OpenAI service initialized",
                    category: "initialization",
                    level: "info",
                });
            },
            {
                tags: {
                    component: "openai_service",
                },
            }
        );
    }

    async generateResponse(prompt: string): Promise<{
        response: string;
        ragContext: {
            documentsFound: number;
            hasRAGContext: boolean;
        };
    }> {
        return await sentryService.trackModelInference(
            "gpt-4o-mini",
            async () => {
                try {
                    logger.info("Starting RAG search", {
                        promptLength: prompt.length,
                        prompt: prompt.substring(0, 100),
                    });

                    // Step 1: Search for relevant documents using RAG
                    const relevantDocs = await sentryService.trackOperation(
                        "rag.search",
                        () => this.ragService.searchDocuments(prompt, 3),
                        {
                            tags: {
                                query_length: prompt.length,
                            },
                        }
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

                        logger.info("RAG documents found", {
                            documentsFound: relevantDocs.length,
                            documents: relevantDocs.map(
                                (d) => d.metadata.source
                            ),
                        });

                        sentryService.addBreadcrumb({
                            message: "RAG documents found",
                            category: "rag",
                            level: "info",
                            data: {
                                documentsFound: relevantDocs.length,
                                promptLength: prompt.length,
                            },
                        });
                    } else {
                        // No relevant documents found, use general knowledge
                        systemPrompt = `You are a helpful AI assistant. Please provide clear, natural responses without using exclamation marks (!) in your text. This is important for text-to-speech pronunciation accuracy, as exclamation marks can be mispronounced as "factorial" by TTS systems. Use periods, commas, and other punctuation as needed, but avoid exclamation marks entirely.

No relevant documents were found in the knowledge base for this query, so please answer using your general knowledge.`;

                        console.log(
                            "🧠 No relevant documents found, using general knowledge"
                        );

                        sentryService.addBreadcrumb({
                            message: "No RAG documents found",
                            category: "rag",
                            level: "warning",
                            data: {
                                promptLength: prompt.length,
                            },
                        });
                    }

                    const messages = [
                        new SystemMessage(systemPrompt),
                        new HumanMessage(prompt),
                    ];

                    const response = await sentryService.trackApiCall(
                        "openai.chat",
                        () => this.chatModel.invoke(messages),
                        {
                            endpoint: "chat/completions",
                            method: "POST",
                        }
                    );

                    if (!response.content) {
                        throw new Error("Invalid LangChain OpenAI response");
                    }

                    // Additional safety check to remove any exclamation marks that might have slipped through
                    const cleanedResponse = response.content
                        .toString()
                        .replace(/!/g, ".");

                    sentryService.trackMetric(
                        "openai.response.length",
                        cleanedResponse.length,
                        "characters",
                        {
                            has_rag: String(relevantDocs.length > 0),
                        }
                    );

                    return {
                        response: cleanedResponse,
                        ragContext: {
                            documentsFound: relevantDocs.length,
                            hasRAGContext: relevantDocs.length > 0,
                        },
                    };
                } catch (error) {
                    console.error("LangChain OpenAI Error:", error);

                    logger.error("OpenAI API call failed", {
                        error:
                            error instanceof Error
                                ? error.message
                                : "Unknown error",
                        promptLength: prompt.length,
                    });

                    sentryService.captureException(error, {
                        tags: {
                            error_type: "openai_error",
                            component: "openai_service",
                            operation: "generate_response",
                        },
                        extra: {
                            promptLength: prompt.length,
                            prompt: prompt.substring(0, 200),
                        },
                        level: "error",
                    });

                    throw new Error("Failed to generate AI response");
                }
            },
            {
                inputLength: prompt.length,
            }
        );
    }

    async textToSpeech(text: string): Promise<string> {
        return await sentryService.trackApiCall(
            "openai.tts",
            async () => {
                try {
                    const response = await this.client.audio.speech.create({
                        model: "tts-1",
                        voice: "alloy",
                        input: text,
                        response_format: "wav",
                    });

                    const buffer = Buffer.from(await response.arrayBuffer());
                    const base64 = buffer.toString("base64");

                    sentryService.trackMetric(
                        "openai.tts.output_size",
                        buffer.length,
                        "bytes",
                        {
                            text_length: String(text.length),
                        }
                    );

                    return base64;
                } catch (error) {
                    console.error("English TTS Error:", error);

                    logger.error("OpenAI TTS failed", {
                        error:
                            error instanceof Error
                                ? error.message
                                : "Unknown error",
                        textLength: text.length,
                    });

                    sentryService.captureException(error, {
                        tags: {
                            error_type: "tts_error",
                            component: "openai_service",
                            operation: "text_to_speech",
                        },
                        extra: {
                            textLength: text.length,
                            text: text.substring(0, 100),
                        },
                        level: "error",
                    });

                    throw new Error("Failed to generate English speech");
                }
            },
            {
                endpoint: "audio/speech",
                method: "POST",
            }
        );
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
