import { PostHog } from "posthog-node";
import { config } from "../config";
import {
    InputType,
    Language,
    DatabaseUserEvent,
    MessageLogData,
    ResponseLogData,
    LanguageChangeLogData,
    RAGQueryLogData,
    ErrorLogData,
    AnalyticsEventLogData,
} from "../types";
import {
    databaseService,
    EventType,
    ErrorType,
    Language as DBLanguage,
    InputType as DBInputType,
} from "./database";

// Re-export original interfaces for backwards compatibility
export interface AnalyticsEvent {
    userId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
}

export interface MessageEvent extends AnalyticsEvent {
    inputType: InputType;
    inputLanguage: string;
    outputLanguage: string;
    messageLength: number;
    hasRAGContext?: boolean;
    ragDocumentsFound?: number;
    processingTimeMs?: number;
}

export interface ErrorEvent extends AnalyticsEvent {
    errorType: string;
    errorMessage: string;
    context: string;
}

export interface RAGEvent extends AnalyticsEvent {
    query: string;
    documentsFound: number;
    relevantChunks: number;
    hasResults: boolean;
}

export interface LanguageEvent extends AnalyticsEvent {
    previousInputLanguage?: string;
    previousOutputLanguage?: string;
    newInputLanguage?: string;
    newOutputLanguage?: string;
    changeType: "input" | "output" | "both";
}

export class EnhancedAnalyticsService {
    private posthog: PostHog | null = null;
    private isPostHogEnabled: boolean = false;
    private isDatabaseEnabled: boolean = true;

    constructor() {
        this.initializePostHog();
        this.initializeDatabase();
    }

    private initializePostHog(): void {
        if (config.posthogApiKey && config.posthogHost) {
            try {
                this.posthog = new PostHog(config.posthogApiKey, {
                    host: config.posthogHost,
                    flushAt: 1,
                    flushInterval: 10000,
                });
                this.isPostHogEnabled = true;
                console.log("📊 PostHog Analytics initialized");
            } catch (error) {
                console.error("❌ Failed to initialize PostHog:", error);
                this.isPostHogEnabled = false;
            }
        } else {
            console.log("📊 PostHog not configured (missing API key or host)");
            this.isPostHogEnabled = false;
        }
    }

    private async initializeDatabase(): Promise<void> {
        try {
            await databaseService.connect();
            this.isDatabaseEnabled = true;
            console.log("📊 Database Analytics initialized");
        } catch (error) {
            console.error("❌ Failed to initialize Database Analytics:", error);
            this.isDatabaseEnabled = false;
        }
    }

    // Helper functions
    private getUserId(event: AnalyticsEvent): string {
        return `telegram_${event.userId}`;
    }

    private getUserProperties(event: AnalyticsEvent) {
        return {
            platform: "telegram",
            username: event.username,
            firstName: event.firstName,
            lastName: event.lastName,
            userId: event.userId,
        };
    }

    private stringToLanguage(lang: string): Language {
        switch (lang.toLowerCase()) {
            case "hindi":
                return "hindi";
            case "english":
                return "english";
            case "assamese":
                return "assamese";
            case "punjabi":
                return "punjabi";
            default:
                return "hindi";
        }
    }

    private stringToDBLanguage(lang: string): DBLanguage {
        switch (lang.toLowerCase()) {
            case "hindi":
                return DBLanguage.HINDI;
            case "english":
                return DBLanguage.ENGLISH;
            case "assamese":
                return DBLanguage.ASSAMESE;
            case "punjabi":
                return DBLanguage.PUNJABI;
            default:
                return DBLanguage.HINDI;
        }
    }

    private stringToErrorType(errorType: string): ErrorType {
        switch (errorType.toUpperCase()) {
            case "BOT_ERROR":
                return ErrorType.BOT_ERROR;
            case "PROCESSING_ERROR":
                return ErrorType.PROCESSING_ERROR;
            case "RAG_ERROR":
                return ErrorType.RAG_ERROR;
            case "TRANSLATION_ERROR":
                return ErrorType.TRANSLATION_ERROR;
            case "TTS_ERROR":
                return ErrorType.TTS_ERROR;
            case "STT_ERROR":
                return ErrorType.STT_ERROR;
            case "OPENAI_ERROR":
                return ErrorType.OPENAI_ERROR;
            case "BHASHINI_ERROR":
                return ErrorType.BHASHINI_ERROR;
            case "RAG_STATS_ERROR":
                return ErrorType.RAG_STATS_ERROR;
            default:
                return ErrorType.UNKNOWN_ERROR;
        }
    }

    private stringToEventType(eventType: string): EventType {
        switch (eventType.toUpperCase()) {
            case "BOT_STARTED":
                return EventType.BOT_STARTED;
            case "MESSAGE_PROCESSED":
                return EventType.MESSAGE_PROCESSED;
            case "VOICE_MESSAGE":
                return EventType.VOICE_MESSAGE;
            case "TEXT_MESSAGE":
                return EventType.TEXT_MESSAGE;
            case "LANGUAGE_CHANGED":
                return EventType.LANGUAGE_CHANGED;
            case "RAG_QUERY_EXECUTED":
                return EventType.RAG_QUERY_EXECUTED;
            case "CALLBACK_QUERY":
                return EventType.CALLBACK_QUERY;
            case "ERROR_OCCURRED":
                return EventType.ERROR_OCCURRED;
            case "SESSION_STARTED":
                return EventType.SESSION_STARTED;
            case "SESSION_ENDED":
                return EventType.SESSION_ENDED;
            default:
                return EventType.BOT_STARTED;
        }
    }

    private async ensureUserExists(event: AnalyticsEvent): Promise<number> {
        if (!this.isDatabaseEnabled) return 0;

        try {
            const user = await databaseService.createOrUpdateUser({
                telegramUserId: event.userId,
                username: event.username,
                firstName: event.firstName,
                lastName: event.lastName,
            });
            return user.id;
        } catch (error) {
            console.error("❌ Error ensuring user exists:", error);
            return 0;
        }
    }

    // Core tracking methods
    async trackBotStart(event: AnalyticsEvent): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "bot_started",
                    properties: {
                        ...this.getUserProperties(event),
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Analytics error (bot_started):", error);
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    const session =
                        await databaseService.createOrGetActiveSession(userId);
                    await databaseService.logAnalyticsEvent({
                        userId,
                        sessionId: session.id,
                        eventType: EventType.BOT_STARTED,
                        eventData: {
                            username: event.username,
                            firstName: event.firstName,
                            lastName: event.lastName,
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error("Database analytics error (bot_started):", error);
            }
        }
    }

    async trackMessageProcessing(
        event: MessageEvent,
        messageId?: string,
        responseId?: string,
        sessionId?: string,
        conversationId?: string
    ): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "message_processed",
                    properties: {
                        ...this.getUserProperties(event),
                        inputType: event.inputType,
                        inputLanguage: event.inputLanguage,
                        outputLanguage: event.outputLanguage,
                        messageLength: event.messageLength,
                        hasRAGContext: event.hasRAGContext || false,
                        ragDocumentsFound: event.ragDocumentsFound || 0,
                        processingTimeMs: event.processingTimeMs,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Analytics error (message_processed):", error);
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled && messageId) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    await databaseService.logAnalyticsEvent({
                        userId,
                        sessionId,
                        eventType: EventType.MESSAGE_PROCESSED,
                        eventData: {
                            messageId,
                            responseId,
                            inputType: event.inputType,
                            inputLanguage: event.inputLanguage,
                            outputLanguage: event.outputLanguage,
                            messageLength: event.messageLength,
                            hasRAGContext: event.hasRAGContext,
                            ragDocumentsFound: event.ragDocumentsFound,
                            processingTimeMs: event.processingTimeMs,
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (message_processed):",
                    error
                );
            }
        }
    }

    async trackVoiceMessage(event: MessageEvent): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "voice_message_received",
                    properties: {
                        ...this.getUserProperties(event),
                        inputLanguage: event.inputLanguage,
                        outputLanguage: event.outputLanguage,
                        processingTimeMs: event.processingTimeMs,
                        hasRAGContext: event.hasRAGContext || false,
                        ragDocumentsFound: event.ragDocumentsFound || 0,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error(
                    "Analytics error (voice_message_received):",
                    error
                );
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    const session =
                        await databaseService.createOrGetActiveSession(userId);
                    await databaseService.logAnalyticsEvent({
                        userId,
                        sessionId: session.id,
                        eventType: EventType.VOICE_MESSAGE,
                        eventData: {
                            inputLanguage: event.inputLanguage,
                            outputLanguage: event.outputLanguage,
                            processingTimeMs: event.processingTimeMs,
                            hasRAGContext: event.hasRAGContext,
                            ragDocumentsFound: event.ragDocumentsFound,
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (voice_message_received):",
                    error
                );
            }
        }
    }

    async trackTextMessage(event: MessageEvent): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "text_message_received",
                    properties: {
                        ...this.getUserProperties(event),
                        inputLanguage: event.inputLanguage,
                        outputLanguage: event.outputLanguage,
                        messageLength: event.messageLength,
                        processingTimeMs: event.processingTimeMs,
                        hasRAGContext: event.hasRAGContext || false,
                        ragDocumentsFound: event.ragDocumentsFound || 0,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error(
                    "Analytics error (text_message_received):",
                    error
                );
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    const session =
                        await databaseService.createOrGetActiveSession(userId);
                    await databaseService.logAnalyticsEvent({
                        userId,
                        sessionId: session.id,
                        eventType: EventType.TEXT_MESSAGE,
                        eventData: {
                            inputLanguage: event.inputLanguage,
                            outputLanguage: event.outputLanguage,
                            messageLength: event.messageLength,
                            processingTimeMs: event.processingTimeMs,
                            hasRAGContext: event.hasRAGContext,
                            ragDocumentsFound: event.ragDocumentsFound,
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (text_message_received):",
                    error
                );
            }
        }
    }

    async trackLanguageChange(event: LanguageEvent): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "language_changed",
                    properties: {
                        ...this.getUserProperties(event),
                        changeType: event.changeType,
                        previousInputLanguage: event.previousInputLanguage,
                        previousOutputLanguage: event.previousOutputLanguage,
                        newInputLanguage: event.newInputLanguage,
                        newOutputLanguage: event.newOutputLanguage,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Analytics error (language_changed):", error);
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    await databaseService.logLanguageChange({
                        userId,
                        changeType: event.changeType,
                        previousInputLanguage: event.previousInputLanguage
                            ? this.stringToDBLanguage(
                                  event.previousInputLanguage
                              )
                            : undefined,
                        previousOutputLanguage: event.previousOutputLanguage
                            ? this.stringToDBLanguage(
                                  event.previousOutputLanguage
                              )
                            : undefined,
                        newInputLanguage: event.newInputLanguage
                            ? this.stringToDBLanguage(event.newInputLanguage)
                            : undefined,
                        newOutputLanguage: event.newOutputLanguage
                            ? this.stringToDBLanguage(event.newOutputLanguage)
                            : undefined,
                        triggeredBy: "user_action",
                    });

                    await databaseService.logAnalyticsEvent({
                        userId,
                        eventType: EventType.LANGUAGE_CHANGED,
                        eventData: {
                            changeType: event.changeType,
                            previousInputLanguage: event.previousInputLanguage,
                            previousOutputLanguage:
                                event.previousOutputLanguage,
                            newInputLanguage: event.newInputLanguage,
                            newOutputLanguage: event.newOutputLanguage,
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (language_changed):",
                    error
                );
            }
        }
    }

    async trackRAGStatsViewed(event: AnalyticsEvent): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "rag_stats_viewed",
                    properties: {
                        ...this.getUserProperties(event),
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Analytics error (rag_stats_viewed):", error);
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    await databaseService.logAnalyticsEvent({
                        userId,
                        eventType: EventType.RAG_QUERY_EXECUTED,
                        eventData: {
                            action: "rag_stats_viewed",
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (rag_stats_viewed):",
                    error
                );
            }
        }
    }

    async trackRAGQuery(event: RAGEvent, messageId?: string): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "rag_query_executed",
                    properties: {
                        ...this.getUserProperties(event),
                        queryLength: event.query.length,
                        documentsFound: event.documentsFound,
                        relevantChunks: event.relevantChunks,
                        hasResults: event.hasResults,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Analytics error (rag_query_executed):", error);
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled && messageId) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    await databaseService.logRAGQuery({
                        messageId,
                        userId,
                        query: event.query,
                        documentsFound: event.documentsFound,
                        relevantChunks: event.relevantChunks,
                        hasResults: event.hasResults,
                    });

                    await databaseService.logAnalyticsEvent({
                        userId,
                        eventType: EventType.RAG_QUERY_EXECUTED,
                        eventData: {
                            messageId,
                            queryLength: event.query.length,
                            documentsFound: event.documentsFound,
                            relevantChunks: event.relevantChunks,
                            hasResults: event.hasResults,
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (rag_query_executed):",
                    error
                );
            }
        }
    }

    async trackError(event: ErrorEvent): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "error_occurred",
                    properties: {
                        ...this.getUserProperties(event),
                        errorType: event.errorType,
                        errorMessage: event.errorMessage,
                        context: event.context,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Analytics error (error_occurred):", error);
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled) {
            try {
                const userId = await this.ensureUserExists(event);
                await databaseService.logError({
                    userId: userId > 0 ? userId : undefined,
                    errorType: this.stringToErrorType(event.errorType),
                    errorMessage: event.errorMessage,
                    errorContext: event.context,
                });

                if (userId > 0) {
                    await databaseService.logAnalyticsEvent({
                        userId,
                        eventType: EventType.ERROR_OCCURRED,
                        eventData: {
                            errorType: event.errorType,
                            errorMessage: event.errorMessage,
                            context: event.context,
                        },
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (error_occurred):",
                    error
                );
            }
        }
    }

    async trackCallbackQuery(
        event: AnalyticsEvent & { callbackData: string }
    ): Promise<void> {
        // PostHog tracking
        if (this.isPostHogEnabled && this.posthog) {
            try {
                this.posthog.capture({
                    distinctId: this.getUserId(event),
                    event: "callback_query_executed",
                    properties: {
                        ...this.getUserProperties(event),
                        callbackData: event.callbackData,
                        timestamp: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error(
                    "Analytics error (callback_query_executed):",
                    error
                );
            }
        }

        // Database tracking
        if (this.isDatabaseEnabled) {
            try {
                const userId = await this.ensureUserExists(event);
                if (userId > 0) {
                    await databaseService.logAnalyticsEvent({
                        userId,
                        eventType: EventType.CALLBACK_QUERY,
                        callbackData: event.callbackData,
                        platform: "telegram",
                    });
                }
            } catch (error) {
                console.error(
                    "Database analytics error (callback_query_executed):",
                    error
                );
            }
        }
    }

    // Database-specific methods
    async logMessage(data: MessageLogData): Promise<string | null> {
        if (!this.isDatabaseEnabled) return null;

        try {
            const userId = await this.ensureUserExists(data);
            if (userId === 0) return null;

            const message = await databaseService.logMessage({
                userId,
                sessionId: data.sessionId,
                conversationId: data.conversationId,
                inputType:
                    data.inputType === "voice"
                        ? DBInputType.VOICE
                        : DBInputType.TEXT,
                originalText: data.originalText,
                processedText: data.processedText,
                audioFileId: data.audioFileId,
                inputLanguage: this.stringToDBLanguage(data.inputLanguage),
                messageLength: data.messageLength,
                processingTimeMs: data.processingTimeMs,
            });

            return message.id;
        } catch (error) {
            console.error("Database error (logMessage):", error);
            return null;
        }
    }

    async logResponse(data: ResponseLogData): Promise<string | null> {
        if (!this.isDatabaseEnabled) return null;

        try {
            const userId = await this.ensureUserExists(data);
            if (userId === 0) return null;

            const response = await databaseService.logResponse({
                messageId: data.messageId,
                userId,
                sessionId: data.sessionId,
                conversationId: data.conversationId,
                responseText: data.responseText,
                translatedText: data.translatedText,
                audioBase64: data.audioBase64,
                outputLanguage: this.stringToDBLanguage(data.outputLanguage),
                hasRAGContext: data.hasRAGContext,
                ragDocumentsFound: data.ragDocumentsFound,
                processingTimeMs: data.processingTimeMs,
                totalTokensUsed: data.totalTokensUsed,
                aiModel: data.aiModel,
            });

            return response.id;
        } catch (error) {
            console.error("Database error (logResponse):", error);
            return null;
        }
    }

    async shutdown(): Promise<void> {
        if (this.posthog) {
            try {
                await this.posthog.shutdown();
                console.log("📊 PostHog Analytics shut down");
            } catch (error) {
                console.error("❌ Error shutting down PostHog:", error);
            }
        }

        if (this.isDatabaseEnabled) {
            try {
                await databaseService.disconnect();
                console.log("📊 Database Analytics shut down");
            } catch (error) {
                console.error(
                    "❌ Error shutting down Database Analytics:",
                    error
                );
            }
        }
    }

    // Helper method to create basic user event data
    createUserEvent(ctx: any): AnalyticsEvent {
        return {
            userId: ctx.from?.id || 0,
            username: ctx.from?.username,
            firstName: ctx.from?.first_name,
            lastName: ctx.from?.last_name,
        };
    }

    // Additional convenience methods
    async createDatabaseUserEvent(ctx: any): Promise<DatabaseUserEvent | null> {
        if (!this.isDatabaseEnabled) return null;

        const baseEvent = this.createUserEvent(ctx);
        const userId = await this.ensureUserExists(baseEvent);

        if (userId === 0) return null;

        const session = await databaseService.createOrGetActiveSession(userId);
        const conversation =
            await databaseService.createOrGetActiveConversation(userId);

        return {
            userId,
            telegramUserId: baseEvent.userId,
            username: baseEvent.username,
            firstName: baseEvent.firstName,
            lastName: baseEvent.lastName,
            sessionId: session.id,
            conversationId: conversation.id,
        };
    }
}
