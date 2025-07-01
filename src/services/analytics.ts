import { PostHog } from "posthog-node";
import { config } from "../config";
import { InputType, UserLanguageSettings } from "../types";

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

export class AnalyticsService {
    private posthog: PostHog | null = null;
    private isEnabled: boolean = false;

    constructor() {
        if (config.posthogApiKey && config.posthogHost) {
            try {
                this.posthog = new PostHog(config.posthogApiKey, {
                    host: config.posthogHost,
                    flushAt: 1, // Send events immediately in development
                    flushInterval: 10000, // 10 seconds
                });
                this.isEnabled = true;
                console.log("📊 PostHog Analytics initialized");
            } catch (error) {
                console.error("❌ Failed to initialize PostHog:", error);
                this.isEnabled = false;
            }
        } else {
            console.log("📊 PostHog not configured (missing API key or host)");
            this.isEnabled = false;
        }
    }

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

    async trackBotStart(event: AnalyticsEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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

    async trackLanguageChange(event: LanguageEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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

    async trackMessageProcessing(event: MessageEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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

    async trackRAGQuery(event: RAGEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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

    async trackRAGStatsViewed(event: AnalyticsEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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

    async trackVoiceMessage(event: MessageEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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
            console.error("Analytics error (voice_message_received):", error);
        }
    }

    async trackTextMessage(event: MessageEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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
            console.error("Analytics error (text_message_received):", error);
        }
    }

    async trackError(event: ErrorEvent): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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

    async trackCallbackQuery(
        event: AnalyticsEvent & { callbackData: string }
    ): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

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
            console.error("Analytics error (callback_query_executed):", error);
        }
    }

    async trackUserSession(
        event: AnalyticsEvent & { sessionDurationMs?: number }
    ): Promise<void> {
        if (!this.isEnabled || !this.posthog) return;

        try {
            this.posthog.capture({
                distinctId: this.getUserId(event),
                event: "user_session",
                properties: {
                    ...this.getUserProperties(event),
                    sessionDurationMs: event.sessionDurationMs,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            console.error("Analytics error (user_session):", error);
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
}
