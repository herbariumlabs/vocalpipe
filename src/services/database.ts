import { PrismaClient } from "../../dist/generated/prisma";
import {
    Language,
    InputType,
    EventType,
    ErrorType,
} from "../../dist/generated/prisma";
import { UserLanguageSettings } from "../types";

// Re-export Prisma types for convenience
export {
    Language,
    InputType,
    EventType,
    ErrorType,
} from "../../dist/generated/prisma";

// Database interfaces
export interface CreateUserData {
    telegramUserId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    inputLanguage?: Language;
    outputLanguage?: Language;
}

export interface CreateMessageData {
    userId: number;
    sessionId?: string;
    conversationId?: string;
    inputType: InputType;
    originalText?: string;
    processedText?: string;
    audioFileId?: string;
    inputLanguage: Language;
    messageLength: number;
    processingTimeMs?: number;
}

export interface CreateResponseData {
    messageId: string;
    userId: number;
    sessionId?: string;
    conversationId?: string;
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

export interface CreateLanguageChangeData {
    userId: number;
    changeType: "input" | "output" | "both";
    previousInputLanguage?: Language;
    previousOutputLanguage?: Language;
    newInputLanguage?: Language;
    newOutputLanguage?: Language;
    triggeredBy?: string;
}

export interface CreateRAGQueryData {
    messageId: string;
    userId: number;
    query: string;
    documentsFound: number;
    relevantChunks: number;
    hasResults: boolean;
    searchTimeMs?: number;
    topDocuments?: any;
    relevanceScores?: any;
}

export interface CreateAnalyticsEventData {
    userId: number;
    sessionId?: string;
    eventType: EventType;
    eventData?: any;
    callbackData?: string;
    platform?: string;
}

export interface CreateErrorData {
    userId?: number;
    errorType: ErrorType;
    errorMessage: string;
    errorContext?: string;
    stackTrace?: string;
    additionalData?: any;
}

export interface UserSessionData {
    userId: number;
    messagesCount?: number;
    voiceMessagesCount?: number;
    textMessagesCount?: number;
    languageChangesCount?: number;
    totalProcessingTime?: number;
}

export class DatabaseService {
    private prisma: PrismaClient;
    private static instance: DatabaseService;

    constructor() {
        this.prisma = new PrismaClient({
            log: ["query", "info", "warn", "error"],
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });
    }

    static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    async connect(): Promise<void> {
        try {
            await this.prisma.$connect();
            console.log("📊 Database connected successfully");
        } catch (error) {
            console.error("❌ Failed to connect to database:", error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
        console.log("📊 Database disconnected");
    }

    // Helper function to convert string language to enum
    private stringToLanguage(lang: string): Language {
        switch (lang.toLowerCase()) {
            case "hindi":
                return Language.HINDI;
            case "english":
                return Language.ENGLISH;
            case "assamese":
                return Language.ASSAMESE;
            case "punjabi":
                return Language.PUNJABI;
            default:
                return Language.HINDI;
        }
    }

    // Helper function to convert enum to string for backwards compatibility
    private languageToString(lang: Language): string {
        switch (lang) {
            case Language.HINDI:
                return "hindi";
            case Language.ENGLISH:
                return "english";
            case Language.ASSAMESE:
                return "assamese";
            case Language.PUNJABI:
                return "punjabi";
            default:
                return "hindi";
        }
    }

    // User Management
    async createOrUpdateUser(data: CreateUserData) {
        const {
            telegramUserId,
            username,
            firstName,
            lastName,
            inputLanguage,
            outputLanguage,
        } = data;

        return await this.prisma.user.upsert({
            where: { telegramUserId: BigInt(telegramUserId) },
            update: {
                username,
                firstName,
                lastName,
                inputLanguage: inputLanguage || Language.HINDI,
                outputLanguage: outputLanguage || Language.HINDI,
                lastActiveAt: new Date(),
            },
            create: {
                telegramUserId: BigInt(telegramUserId),
                username,
                firstName,
                lastName,
                inputLanguage: inputLanguage || Language.HINDI,
                outputLanguage: outputLanguage || Language.HINDI,
            },
        });
    }

    async getUserByTelegramId(telegramUserId: number) {
        return await this.prisma.user.findUnique({
            where: { telegramUserId: BigInt(telegramUserId) },
            include: {
                sessions: { where: { isActive: true }, take: 1 },
                conversations: { where: { isActive: true }, take: 1 },
            },
        });
    }

    async updateUserLanguageSettings(
        telegramUserId: number,
        settings: UserLanguageSettings
    ) {
        const inputLang = this.stringToLanguage(settings.input);
        const outputLang = this.stringToLanguage(settings.output);

        return await this.prisma.user.update({
            where: { telegramUserId: BigInt(telegramUserId) },
            data: {
                inputLanguage: inputLang,
                outputLanguage: outputLang,
                lastActiveAt: new Date(),
            },
        });
    }

    async getUserLanguageSettings(
        telegramUserId: number
    ): Promise<UserLanguageSettings | null> {
        const user = await this.prisma.user.findUnique({
            where: { telegramUserId: BigInt(telegramUserId) },
            select: { inputLanguage: true, outputLanguage: true },
        });

        if (!user) return null;

        return {
            input: this.languageToString(user.inputLanguage) as any,
            output: this.languageToString(user.outputLanguage) as any,
        };
    }

    // Session Management
    async createOrGetActiveSession(userId: number) {
        // Try to get an active session
        let session = await this.prisma.userSession.findFirst({
            where: { userId, isActive: true },
        });

        if (!session) {
            // Create a new session
            session = await this.prisma.userSession.create({
                data: { userId },
            });
        }

        return session;
    }

    async updateSessionStats(
        sessionId: string,
        data: Partial<UserSessionData>
    ) {
        return await this.prisma.userSession.update({
            where: { id: sessionId },
            data: {
                messagesCount: { increment: data.messagesCount || 0 },
                voiceMessagesCount: { increment: data.voiceMessagesCount || 0 },
                textMessagesCount: { increment: data.textMessagesCount || 0 },
                languageChangesCount: {
                    increment: data.languageChangesCount || 0,
                },
                totalProcessingTime: {
                    increment: data.totalProcessingTime || 0,
                },
            },
        });
    }

    async endSession(sessionId: string) {
        return await this.prisma.userSession.update({
            where: { id: sessionId },
            data: {
                endedAt: new Date(),
                isActive: false,
            },
        });
    }

    // Conversation Management
    async createOrGetActiveConversation(userId: number) {
        // Try to get an active conversation
        let conversation = await this.prisma.conversation.findFirst({
            where: { userId, isActive: true },
        });

        if (!conversation) {
            // Create a new conversation
            conversation = await this.prisma.conversation.create({
                data: { userId },
            });
        }

        return conversation;
    }

    // Message and Response Logging
    async logMessage(data: CreateMessageData) {
        const message = await this.prisma.message.create({
            data: data,
        });

        // Update user message counts
        await this.prisma.user.update({
            where: { id: data.userId },
            data: {
                totalMessages: { increment: 1 },
                totalVoiceMessages: {
                    increment: data.inputType === InputType.VOICE ? 1 : 0,
                },
                totalTextMessages: {
                    increment: data.inputType === InputType.TEXT ? 1 : 0,
                },
                lastActiveAt: new Date(),
            },
        });

        return message;
    }

    async logResponse(data: CreateResponseData) {
        return await this.prisma.response.create({
            data: data,
        });
    }

    // Language Change Tracking
    async logLanguageChange(data: CreateLanguageChangeData) {
        return await this.prisma.languageChange.create({
            data: data,
        });
    }

    // RAG Query Tracking
    async logRAGQuery(data: CreateRAGQueryData) {
        return await this.prisma.ragQuery.create({
            data: data,
        });
    }

    async updateRAGQueryWithResponse(messageId: string, responseId: string) {
        return await this.prisma.ragQuery.update({
            where: { messageId },
            data: { responseId },
        });
    }

    // Analytics Events
    async logAnalyticsEvent(data: CreateAnalyticsEventData) {
        return await this.prisma.analyticsEvent.create({
            data: data,
        });
    }

    // Error Logging
    async logError(data: CreateErrorData) {
        return await this.prisma.error.create({
            data: data,
        });
    }

    // System Metrics
    async logSystemMetric(
        metricName: string,
        metricValue: number,
        metricUnit?: string,
        tags?: any
    ) {
        return await this.prisma.systemMetric.create({
            data: {
                metricName,
                metricValue,
                metricUnit,
                tags,
            },
        });
    }

    // Daily Statistics
    async updateDailyStats(date: Date, statsUpdate: any) {
        const dateOnly = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        return await this.prisma.dailyStats.upsert({
            where: { date: dateOnly },
            update: {
                ...statsUpdate,
                updatedAt: new Date(),
            },
            create: {
                date: dateOnly,
                ...statsUpdate,
            },
        });
    }

    // Analytics Queries
    async getUserStats(telegramUserId: number) {
        const user = await this.prisma.user.findUnique({
            where: { telegramUserId: BigInt(telegramUserId) },
            include: {
                _count: {
                    select: {
                        messages: true,
                        responses: true,
                        languageChanges: true,
                        ragQueries: true,
                        sessions: true,
                    },
                },
            },
        });

        return user;
    }

    async getLanguageDistribution(days: number = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const languageChanges = await this.prisma.languageChange.groupBy({
            by: ["newInputLanguage", "newOutputLanguage"],
            where: {
                timestamp: { gte: since },
            },
            _count: true,
        });

        const currentLanguages = await this.prisma.user.groupBy({
            by: ["inputLanguage", "outputLanguage"],
            _count: true,
        });

        return { languageChanges, currentLanguages };
    }

    async getSystemPerformanceMetrics(days: number = 7) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const avgProcessingTimes = await this.prisma.message.aggregate({
            where: {
                timestamp: { gte: since },
                processingTimeMs: { not: null },
            },
            _avg: { processingTimeMs: true },
        });

        const ragPerformance = await this.prisma.ragQuery.aggregate({
            where: {
                timestamp: { gte: since },
                searchTimeMs: { not: null },
            },
            _avg: { searchTimeMs: true },
            _count: true,
        });

        return { avgProcessingTimes, ragPerformance };
    }

    async getTopErrors(days: number = 7, limit: number = 10) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        return await this.prisma.error.groupBy({
            by: ["errorType", "errorContext"],
            where: {
                timestamp: { gte: since },
            },
            _count: true,
            orderBy: {
                _count: {
                    errorType: "desc",
                },
            },
            take: limit,
        });
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            console.error("Database health check failed:", error);
            return false;
        }
    }
}

export const databaseService = DatabaseService.getInstance();
