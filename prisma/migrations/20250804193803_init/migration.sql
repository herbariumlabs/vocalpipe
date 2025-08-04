-- CreateEnum
CREATE TYPE "public"."Language" AS ENUM ('HINDI', 'ENGLISH', 'ASSAMESE', 'PUNJABI');

-- CreateEnum
CREATE TYPE "public"."InputType" AS ENUM ('TEXT', 'VOICE');

-- CreateEnum
CREATE TYPE "public"."EventType" AS ENUM ('BOT_STARTED', 'MESSAGE_PROCESSED', 'VOICE_MESSAGE', 'TEXT_MESSAGE', 'LANGUAGE_CHANGED', 'RAG_QUERY_EXECUTED', 'CALLBACK_QUERY', 'ERROR_OCCURRED', 'SESSION_STARTED', 'SESSION_ENDED');

-- CreateEnum
CREATE TYPE "public"."ErrorType" AS ENUM ('BOT_ERROR', 'PROCESSING_ERROR', 'RAG_ERROR', 'TRANSLATION_ERROR', 'TTS_ERROR', 'STT_ERROR', 'OPENAI_ERROR', 'BHASHINI_ERROR', 'RAG_STATS_ERROR', 'UNKNOWN_ERROR');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "inputLanguage" "public"."Language" NOT NULL DEFAULT 'HINDI',
    "outputLanguage" "public"."Language" NOT NULL DEFAULT 'HINDI',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalVoiceMessages" INTEGER NOT NULL DEFAULT 0,
    "totalTextMessages" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "messagesCount" INTEGER NOT NULL DEFAULT 0,
    "voiceMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "textMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "languageChangesCount" INTEGER NOT NULL DEFAULT 0,
    "totalProcessingTime" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messagesCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "topic" TEXT,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionId" TEXT,
    "conversationId" TEXT,
    "inputType" "public"."InputType" NOT NULL,
    "originalText" TEXT,
    "processedText" TEXT,
    "audioFileId" TEXT,
    "inputLanguage" "public"."Language" NOT NULL,
    "messageLength" INTEGER NOT NULL DEFAULT 0,
    "processingTimeMs" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."responses" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionId" TEXT,
    "conversationId" TEXT,
    "responseText" TEXT NOT NULL,
    "translatedText" TEXT,
    "audioBase64" TEXT,
    "outputLanguage" "public"."Language" NOT NULL,
    "hasRAGContext" BOOLEAN NOT NULL DEFAULT false,
    "ragDocumentsFound" INTEGER NOT NULL DEFAULT 0,
    "processingTimeMs" INTEGER NOT NULL DEFAULT 0,
    "totalTokensUsed" INTEGER,
    "aiModel" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."language_changes" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "previousInputLanguage" "public"."Language",
    "previousOutputLanguage" "public"."Language",
    "newInputLanguage" "public"."Language",
    "newOutputLanguage" "public"."Language",
    "triggeredBy" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rag_queries" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "responseId" TEXT,
    "userId" INTEGER NOT NULL,
    "query" TEXT NOT NULL,
    "documentsFound" INTEGER NOT NULL DEFAULT 0,
    "relevantChunks" INTEGER NOT NULL DEFAULT 0,
    "hasResults" BOOLEAN NOT NULL DEFAULT false,
    "searchTimeMs" INTEGER,
    "topDocuments" JSONB,
    "relevanceScores" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_events" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionId" TEXT,
    "eventType" "public"."EventType" NOT NULL,
    "eventData" JSONB,
    "callbackData" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'telegram',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."errors" (
    "id" TEXT NOT NULL,
    "userId" INTEGER,
    "errorType" "public"."ErrorType" NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorContext" TEXT,
    "stackTrace" TEXT,
    "additionalData" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_metrics" (
    "id" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "metricUnit" TEXT,
    "tags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_stats" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalVoiceMessages" INTEGER NOT NULL DEFAULT 0,
    "totalTextMessages" INTEGER NOT NULL DEFAULT 0,
    "totalRAGQueries" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "languageDistribution" JSONB,
    "avgProcessingTime" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramUserId_key" ON "public"."users"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "responses_messageId_key" ON "public"."responses"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "rag_queries_messageId_key" ON "public"."rag_queries"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "rag_queries_responseId_key" ON "public"."rag_queries"("responseId");

-- CreateIndex
CREATE INDEX "system_metrics_metricName_timestamp_idx" ON "public"."system_metrics"("metricName", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stats_date_key" ON "public"."daily_stats"("date");

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responses" ADD CONSTRAINT "responses_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."language_changes" ADD CONSTRAINT "language_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rag_queries" ADD CONSTRAINT "rag_queries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rag_queries" ADD CONSTRAINT "rag_queries_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rag_queries" ADD CONSTRAINT "rag_queries_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."errors" ADD CONSTRAINT "errors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
