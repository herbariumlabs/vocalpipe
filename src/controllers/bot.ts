import { Telegraf, Context } from "telegraf";
import { createReadStream } from "fs";
import { writeFileSync } from "fs";
import * as path from "path";
import fetch from "node-fetch";
import { logger } from "../services/logger";
import { BhashiniService } from "../services/bhashini";
import { OpenAIService } from "../services/openai";
import { UserStateService } from "../services/userState";
import { EnhancedProcessorService } from "../services/enhancedProcessor";
import { EnhancedAnalyticsService } from "../services/enhancedAnalytics";
import { yoloService } from "../services/yolo";
import { sentryService } from "../services/sentry";
import { cleanupFiles, ensureDirectoryExists } from "../utils/file";
import { config } from "../config";
import { InputType } from "../types";

export class BotController {
    private bot: Telegraf;
    private bhashiniService: BhashiniService;
    private openaiService: OpenAIService;
    private userStateService: UserStateService;
    private processorService: EnhancedProcessorService;
    private analyticsService: EnhancedAnalyticsService;
    private pendingImages: Map<number, string> = new Map();

    constructor() {
        this.bot = new Telegraf(config.telegramBotToken);
        this.bhashiniService = new BhashiniService();
        this.openaiService = new OpenAIService();
        this.userStateService = new UserStateService();
        this.analyticsService = new EnhancedAnalyticsService();
        this.processorService = new EnhancedProcessorService(
            this.bhashiniService,
            this.openaiService,
            this.userStateService,
            this.analyticsService
        );

        this.setupHandlers();
        ensureDirectoryExists(config.tempDir);
    }

    private setupHandlers(): void {
        this.bot.start(this.handleStart.bind(this));
        this.bot.command(
            "change_language",
            this.handleChangeLanguage.bind(this)
        );
        this.bot.command("rag_stats", this.handleRAGStats.bind(this));
        this.bot.on("callback_query", this.handleCallbackQuery.bind(this));
        this.bot.on("photo", this.handlePhotoMessage.bind(this));
        this.bot.on("voice", this.handleVoiceMessage.bind(this));
        this.bot.on("text", this.handleTextMessage.bind(this));

        this.bot.catch(async (err, ctx) => {
            console.error("❌ Bot Error:", err);

            logger.error("Bot error caught", {
                error: err instanceof Error ? err.message : String(err),
                userId: ctx.from?.id,
                chatId: ctx.chat?.id,
                updateType: ctx.updateType,
            });

            // Set user context for Sentry
            if (ctx.from) {
                sentryService.setUser({
                    id: ctx.from.id,
                    username: ctx.from.username,
                    firstName: ctx.from.first_name,
                    lastName: ctx.from.last_name,
                });
            }

            // Capture error in Sentry
            sentryService.captureException(err, {
                tags: {
                    error_type: "bot_error",
                    context: "bot_catch_handler",
                },
                extra: {
                    chatId: ctx.chat?.id,
                    messageId: ctx.message?.message_id,
                    updateType: ctx.updateType,
                },
            });

            // Track error in analytics
            await this.analyticsService.trackError({
                ...this.analyticsService.createUserEvent(ctx),
                errorType: "bot_error",
                errorMessage:
                    err instanceof Error ? err.message : "Unknown error",
                context: "bot_catch_handler",
            });

            ctx.reply("Sorry, I encountered an error. Please try again later.");
        });
    }

    async launch(): Promise<void> {
        logger.info("Bot controller launching");

        return await sentryService.trackOperation(
            "bot.launch",
            async () => {
                await this.processorService.initialize();
                await this.bot.launch();
                console.log("🤖 VocalPipe Bot is running!");

                logger.info("Bot launched successfully");
            },
            {
                tags: {
                    component: "bot_controller",
                    operation: "launch",
                },
            }
        );
    }

    async stop(): Promise<void> {
        logger.info("Bot controller stopping");

        sentryService.addBreadcrumb({
            message: "Bot stopping",
            category: "lifecycle",
            level: "info",
        });

        await this.analyticsService.shutdown();
        this.bot.stop();

        // Flush Sentry events
        await sentryService.flush(2000);

        logger.info("Bot stopped successfully");
    }

    private async handleStart(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        logger.info(logger.fmt`User started bot: ${userId}`, {
            userId,
            username: ctx.from?.username,
        });

        // Set user context in Sentry
        sentryService.setUser({
            id: userId,
            username: ctx.from?.username,
            firstName: ctx.from?.first_name,
            lastName: ctx.from?.last_name,
        });

        sentryService.addBreadcrumb({
            message: "User started bot",
            category: "user_action",
            level: "info",
            data: { userId },
        });

        this.userStateService.setUserSettings(userId, {
            input: "hindi",
            output: "hindi",
        });

        const ragStats = this.processorService.getRAGStats();

        // Track bot start event
        await this.analyticsService.trackBotStart(
            this.analyticsService.createUserEvent(ctx)
        );

        await ctx.reply(
            "Welcome to Herbarium with RAG!\n\n" +
                "🗣️ Send me a voice message OR type a text message and I will respond with AI-generated audio!\n\n" +
                "📚 RAG System Active: I can now search through local documents to provide more accurate answers.\n\n" +
                `📊 Knowledge Base: ${ragStats.totalDocuments} documents, ${ragStats.totalChunks} chunks\n\n` +
                "🌐 Default: Hindi Input → Hindi Output\n" +
                "Use /change_language to customize both input and output languages.\n" +
                "Use /rag_stats to check the knowledge base status.\n\n" +
                "🔊 Available languages:\n" +
                "• 🇮🇳 Hindi\n" +
                "• 🇺🇸 English\n" +
                "• 🇮🇳 Assamese\n" +
                "• 🇮🇳 Punjabi\n\n"
        );
    }

    private async handleChangeLanguage(ctx: Context): Promise<void> {
        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: "🎤 Choose Input Language",
                        callback_data: "select_input",
                    },
                ],
                [
                    {
                        text: "🔊 Choose Output Language",
                        callback_data: "select_output",
                    },
                ],
                [
                    {
                        text: "📋 View Current Settings",
                        callback_data: "view_settings",
                    },
                ],
            ],
        };

        await ctx.reply("🌐 Language Settings:", { reply_markup: keyboard });
    }

    private async handleRAGStats(ctx: Context): Promise<void> {
        try {
            const stats = this.processorService.getRAGStats();

            // Track RAG stats view
            await this.analyticsService.trackRAGStatsViewed(
                this.analyticsService.createUserEvent(ctx)
            );

            await ctx.reply(
                `RAG Knowledge Base Statistics:\n\n` +
                    `Total Documents: ${stats.totalDocuments}\n` +
                    `Total Chunks: ${stats.totalChunks}\n\n` +
                    `The system will search through these documents first before using general knowledge to answer your questions.`
            );
        } catch (error) {
            console.error("Error getting RAG stats:", error);

            logger.error("Failed to get RAG stats", {
                userId: ctx.from?.id,
                error: error instanceof Error ? error.message : "Unknown error",
            });

            // Capture error in Sentry
            sentryService.captureException(error, {
                tags: {
                    error_type: "rag_stats_error",
                    user_id: String(ctx.from?.id),
                },
                level: "error",
            });

            // Track error in analytics
            await this.analyticsService.trackError({
                ...this.analyticsService.createUserEvent(ctx),
                errorType: "rag_stats_error",
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                context: "handleRAGStats",
            });

            await ctx.reply(
                "Sorry, I couldn't retrieve the knowledge base statistics."
            );
        }
    }

    private async handleCallbackQuery(ctx: Context): Promise<void> {
        const query = ctx.callbackQuery;
        if (!query || !("data" in query)) return;

        const data = query.data;
        if (!data) return;

        // Track callback query
        await this.analyticsService.trackCallbackQuery({
            ...this.analyticsService.createUserEvent(ctx),
            callbackData: data,
        });

        await this.handleCallbackQueryData(ctx, data);
    }

    private async handleCallbackQueryData(
        ctx: Context,
        data: string
    ): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        switch (data) {
            case "ml_maturity":
                await this.handleMaturityDetection(ctx);
                break;
            case "ml_disease":
                await this.handleDiseaseClassification(ctx);
                break;
            case "select_input":
                await this.handleSelectInput(ctx);
                break;
            case "select_output":
                await this.handleSelectOutput(ctx);
                break;
            case "input_hindi":
                await this.handleInputHindi(ctx);
                break;
            case "input_english":
                await this.handleInputEnglish(ctx);
                break;
            case "input_assamese":
                await this.handleInputAssamese(ctx);
                break;
            case "input_punjabi":
                await this.handleInputPunjabi(ctx);
                break;
            case "output_hindi":
                await this.handleOutputHindi(ctx);
                break;
            case "output_english":
                await this.handleOutputEnglish(ctx);
                break;
            case "output_assamese":
                await this.handleOutputAssamese(ctx);
                break;
            case "output_punjabi":
                await this.handleOutputPunjabi(ctx);
                break;
            case "view_settings":
                await this.handleViewSettings(ctx);
                break;
            case "back_to_main":
                await this.handleBackToMain(ctx);
                break;
        }
    }

    private async handleSelectInput(ctx: Context): Promise<void> {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: "🇮🇳 Hindi Input", callback_data: "input_hindi" },
                    {
                        text: "🇺🇸 English Input",
                        callback_data: "input_english",
                    },
                ],
                [
                    {
                        text: "🇮🇳 Assamese Input",
                        callback_data: "input_assamese",
                    },
                    {
                        text: "🇮🇳 Punjabi Input",
                        callback_data: "input_punjabi",
                    },
                ],
                [{ text: "⬅️ Back", callback_data: "back_to_main" }],
            ],
        };

        await ctx.editMessageText("🎤 Choose your input language:", {
            reply_markup: keyboard,
        });
    }

    private async handleSelectOutput(ctx: Context): Promise<void> {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: "🇮🇳 Hindi Output", callback_data: "output_hindi" },
                    {
                        text: "🇺🇸 English Output",
                        callback_data: "output_english",
                    },
                ],
                [
                    {
                        text: "🇮🇳 Assamese Output",
                        callback_data: "output_assamese",
                    },
                    {
                        text: "🇮🇳 Punjabi Output",
                        callback_data: "output_punjabi",
                    },
                ],
                [{ text: "⬅️ Back", callback_data: "back_to_main" }],
            ],
        };

        await ctx.editMessageText("🔊 Choose your output language:", {
            reply_markup: keyboard,
        });
    }

    private async handleInputHindi(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        const previousSettings = this.userStateService.getUserSettings(userId);
        this.userStateService.setInputLanguage(userId, "hindi");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        // Track language change
        await this.analyticsService.trackLanguageChange({
            ...this.analyticsService.createUserEvent(ctx),
            changeType: "input",
            previousInputLanguage: previousSettings.input,
            newInputLanguage: "hindi",
            previousOutputLanguage: previousSettings.output,
            newOutputLanguage: settings.output,
        });

        await ctx.editMessageText(
            `✅ Input language set to Hindi! 🇮🇳\nYou can now send voice messages or text in Hindi.\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleInputEnglish(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setInputLanguage(userId, "english");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        await ctx.editMessageText(
            `✅ Input language set to English! 🇺🇸\nYou can now send voice messages or text in English.\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleInputAssamese(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setInputLanguage(userId, "assamese");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        await ctx.editMessageText(
            `✅ Input language set to Assamese! 🇮🇳\nYou can now send voice messages or text in Assamese.\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleInputPunjabi(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setInputLanguage(userId, "punjabi");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        await ctx.editMessageText(
            `✅ Input language set to Punjabi! 🇮🇳\nYou can now send voice messages or text in Punjabi.\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleOutputHindi(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setOutputLanguage(userId, "hindi");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        await ctx.editMessageText(
            `✅ Output language set to Hindi! 🇮🇳\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleOutputEnglish(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setOutputLanguage(userId, "english");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        await ctx.editMessageText(
            `✅ Output language set to English! 🇺🇸\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleOutputAssamese(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setOutputLanguage(userId, "assamese");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        await ctx.editMessageText(
            `✅ Output language set to Assamese! 🇮🇳\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleOutputPunjabi(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setOutputLanguage(userId, "punjabi");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        await ctx.editMessageText(
            `✅ Output language set to Punjabi! 🇮🇳\n\n📋 Current Configuration:\nInput: ${inputFlag} ${settings.input.charAt(0).toUpperCase() + settings.input.slice(1)}\nOutput: ${outputFlag} ${settings.output.charAt(0).toUpperCase() + settings.output.slice(1)}\n\nUse /change_language to modify other settings.`
        );
    }

    private async handleViewSettings(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        const keyboard = {
            inline_keyboard: [
                [{ text: "⬅️ Back", callback_data: "back_to_main" }],
            ],
        };

        await ctx.editMessageText(
            "Current Language Settings:\n\n" +
                "Input: " +
                inputFlag +
                " " +
                settings.input.charAt(0).toUpperCase() +
                settings.input.slice(1) +
                "\n" +
                "Output: " +
                outputFlag +
                " " +
                settings.output.charAt(0).toUpperCase() +
                settings.output.slice(1) +
                "\n\n" +
                "Workflow: " +
                settings.input +
                " Text/Voice → GPT → " +
                settings.output +
                " Voice\n\n" +
                "You can send both text messages and voice messages in your selected input language!",
            { reply_markup: keyboard }
        );
    }

    private async handleBackToMain(ctx: Context): Promise<void> {
        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: "🎤 Choose Input Language",
                        callback_data: "select_input",
                    },
                ],
                [
                    {
                        text: "🔊 Choose Output Language",
                        callback_data: "select_output",
                    },
                ],
                [
                    {
                        text: "📋 View Current Settings",
                        callback_data: "view_settings",
                    },
                ],
            ],
        };

        await ctx.editMessageText("🌐 Language Settings:", {
            reply_markup: keyboard,
        });
    }

    private async handleTextMessage(ctx: Context): Promise<void> {
        const text = ctx.text;
        if (!text || text.startsWith("/")) return;

        const userId = ctx.from?.id;
        if (!userId) return;

        await this.processUserInput(ctx, userId, text, "text");
    }

    private async handlePhotoMessage(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        const message = ctx.message as any;
        const photo = message?.photo;
        if (!photo || photo.length === 0) return;

        // Get the largest photo
        const largestPhoto = photo[photo.length - 1];
        const fileId = largestPhoto.file_id;

        try {
            logger.info("Image received", { userId, fileId });

            // Download and save image
            const fileLink = await ctx.telegram.getFileLink(fileId);
            const response = await fetch(fileLink.href);
            const buffer = await response.buffer();

            const imagePath = path.join(config.tempDir, `${fileId}.jpg`);
            writeFileSync(imagePath, buffer);

            // Store image path for this user
            this.pendingImages.set(userId, imagePath);

            // Show selection buttons
            const keyboard = {
                inline_keyboard: [
                    [
                        {
                            text: "🌱 Maturity Detection",
                            callback_data: "ml_maturity",
                        },
                    ],
                    [
                        {
                            text: "🔬 Disease Classification",
                            callback_data: "ml_disease",
                        },
                    ],
                ],
            };

            await ctx.reply("Image received! What would you like to analyze?", {
                reply_markup: keyboard,
            });

            logger.info("Image stored, awaiting user selection", { userId });
        } catch (error) {
            console.error("Image download error:", error);

            logger.error("Image download failed", {
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
            });

            sentryService.captureException(error, {
                tags: {
                    error_type: "image_download_error",
                    user_id: String(userId),
                },
                level: "error",
            });

            await ctx.reply("Failed to process your image. Please try again.");
        }
    }

    private async handleMaturityDetection(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        await ctx.answerCbQuery();

        const imagePath = this.pendingImages.get(userId);
        if (!imagePath) {
            await ctx.reply("Image not found. Please upload a new image.");
            return;
        }

        const processingMessage = await ctx.reply(
            "Analyzing maturity stages..."
        );

        try {
            logger.info("Running maturity detection", { userId });

            const detectionResult = await yoloService.detectObjects(imagePath);

            await ctx.deleteMessage(processingMessage.message_id);

            let detectionText = "Maturity Detection Results:\n\n";
            detectionText += `Found ${detectionResult.detections.length} object(s):\n\n`;

            if (detectionResult.detections.length > 0) {
                detectionResult.detections.forEach((det, idx) => {
                    detectionText += `${idx + 1}. ${det.className}\n`;
                    detectionText += `   Confidence: ${(det.confidence * 100).toFixed(2)}%\n`;
                    detectionText += `   Location: (${det.bbox.x}, ${det.bbox.y})\n`;
                    detectionText += `   Size: ${det.bbox.width}x${det.bbox.height}px\n\n`;
                });

                await ctx.replyWithPhoto(
                    {
                        source: createReadStream(
                            detectionResult.annotatedImagePath
                        ),
                    },
                    { caption: detectionText }
                );
            } else {
                await ctx.reply(
                    detectionText + "No maturity stages detected in the image."
                );
            }

            cleanupFiles([imagePath, detectionResult.annotatedImagePath]);
            this.pendingImages.delete(userId);

            logger.info("Maturity detection completed", {
                userId,
                detectionsCount: detectionResult.detections.length,
            });
        } catch (error) {
            console.error("Maturity detection error:", error);

            logger.error("Maturity detection failed", {
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
            });

            sentryService.captureException(error, {
                tags: {
                    error_type: "maturity_detection_error",
                    user_id: String(userId),
                },
                level: "error",
            });

            try {
                await ctx.deleteMessage(processingMessage.message_id);
            } catch (deleteErr) {
                console.error(
                    "Failed to delete processing message:",
                    deleteErr
                );
            }

            await ctx.reply("Failed to analyze maturity. Please try again.");
        }
    }

    private async handleDiseaseClassification(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        await ctx.answerCbQuery();

        const imagePath = this.pendingImages.get(userId);
        if (!imagePath) {
            await ctx.reply("Image not found. Please upload a new image.");
            return;
        }

        const processingMessage = await ctx.reply("Classifying disease...");

        try {
            logger.info("Running disease classification", { userId });

            const classificationResult =
                await yoloService.classifyImage(imagePath);

            await ctx.deleteMessage(processingMessage.message_id);

            let classificationText = "Disease Classification Results:\n\n";
            classificationText += `Top Prediction: ${classificationResult.className}\n`;
            classificationText += `Confidence: ${(classificationResult.confidence * 100).toFixed(2)}%\n\n`;
            classificationText += "All Predictions:\n";
            classificationResult.allPredictions.slice(0, 5).forEach((pred) => {
                classificationText += `- ${pred.className}: ${(pred.confidence * 100).toFixed(2)}%\n`;
            });

            await ctx.reply(classificationText);

            cleanupFiles([imagePath]);
            this.pendingImages.delete(userId);

            logger.info("Disease classification completed", {
                userId,
                classification: classificationResult.className,
            });
        } catch (error) {
            console.error("Disease classification error:", error);

            logger.error("Disease classification failed", {
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
            });

            sentryService.captureException(error, {
                tags: {
                    error_type: "disease_classification_error",
                    user_id: String(userId),
                },
                level: "error",
            });

            try {
                await ctx.deleteMessage(processingMessage.message_id);
            } catch (deleteErr) {
                console.error(
                    "Failed to delete processing message:",
                    deleteErr
                );
            }

            await ctx.reply("Failed to classify disease. Please try again.");
        }
    }

    private async handleVoiceMessage(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        const message = ctx.message as any;
        const fileId = message?.voice?.file_id;
        if (!fileId) return;

        const fileLink = await ctx.telegram.getFileLink(fileId);

        // Show thinking message for voice processing
        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

        const thinkingMessage = await ctx.reply("Thinking...");

        try {
            const result = await this.processorService.processVoiceMessage(
                userId,
                fileLink.href,
                ctx
            );
            await this.sendAudioResponse(ctx, userId, result, "voice");
            await ctx.deleteMessage(thinkingMessage.message_id);

            logger.info("Voice message processed successfully", {
                userId,
                inputLanguage: settings.input,
                outputLanguage: settings.output,
            });
        } catch (error) {
            console.error("Voice processing error:", error);

            logger.error("Voice processing failed", {
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
                inputLanguage: settings.input,
            });

            // Capture error in Sentry with full context
            sentryService.captureException(error, {
                tags: {
                    error_type: "voice_processing_error",
                    user_id: String(userId),
                    input_language: settings.input,
                    output_language: settings.output,
                },
                extra: {
                    fileId,
                    fileLink: fileLink.href,
                },
                level: "error",
            });

            // Track error in analytics
            await this.analyticsService.trackError({
                ...this.analyticsService.createUserEvent(ctx),
                errorType: "voice_processing_error",
                errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                context: "handleVoiceMessage",
            });

            try {
                await ctx.deleteMessage(thinkingMessage.message_id);
            } catch (deleteErr) {
                console.error("Failed to delete thinking message:", deleteErr);
            }
            await ctx.reply(
                "Something went wrong processing your voice message."
            );
        }
    }

    private async processUserInput(
        ctx: Context,
        userId: number,
        inputText: string,
        inputType: InputType
    ): Promise<void> {
        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);
        const inputIcon = inputType === "voice" ? "🎤" : "⌨️";

        const thinkingMessage = await ctx.reply(
            "💬 Thinking... (" + inputIcon + inputFlag + "→" + outputFlag + ")"
        );

        try {
            const result = await this.processorService.processTextInput(
                userId,
                inputText,
                ctx
            );
            await this.sendAudioResponse(ctx, userId, result, inputType);
            await ctx.deleteMessage(thinkingMessage.message_id);
        } catch (error) {
            console.error("Processing error:", error);
            try {
                await ctx.deleteMessage(thinkingMessage.message_id);
            } catch (deleteErr) {
                console.error("Failed to delete thinking message:", deleteErr);
            }
            await ctx.reply("Something went wrong processing your message.");
        }
    }

    private async sendAudioResponse(
        ctx: Context,
        userId: number,
        result: { inputText: string; outputText: string; audioBase64: string },
        inputType: InputType
    ): Promise<void> {
        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);
        const inputIcon = inputType === "voice" ? "🎤" : "⌨️";

        const oggPath = await this.processorService.generateAudioFile(
            result.audioBase64
        );

        try {
            const caption =
                inputIcon +
                inputFlag +
                ' Input: "' +
                result.inputText +
                '"\n🔊' +
                outputFlag +
                " Output: " +
                result.outputText;

            // Telegram caption limit is 1024 characters
            const maxCaptionLength = 1024;

            if (caption.length <= maxCaptionLength) {
                await ctx.replyWithVoice(
                    { source: createReadStream(oggPath) },
                    { caption }
                );
            } else {
                // Send without caption if too long
                await ctx.replyWithVoice({ source: createReadStream(oggPath) });

                // Send the caption as a separate text message
                await ctx.reply(`📝 Response Details:\n\n${caption}`);
            }
        } finally {
            cleanupFiles([oggPath]);
        }
    }
}
