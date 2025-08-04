import { Telegraf, Context } from "telegraf";
import { createReadStream } from "fs";
import { BhashiniService } from "../services/bhashini";
import { OpenAIService } from "../services/openai";
import { UserStateService } from "../services/userState";
import { EnhancedProcessorService } from "../services/enhancedProcessor";
import { EnhancedAnalyticsService } from "../services/enhancedAnalytics";
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
        this.bot.on("voice", this.handleVoiceMessage.bind(this));
        this.bot.on("text", this.handleTextMessage.bind(this));

        this.bot.catch(async (err, ctx) => {
            console.error("❌ Bot Error:", err);

            // Track error
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
        try {
            await this.processorService.initialize();

            await this.bot.launch();
            console.log("🤖 VocalPipe Bot is running!");
        } catch (error) {
            console.error("❌ Failed to launch bot:", error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        await this.analyticsService.shutdown();
        this.bot.stop();
    }

    private async handleStart(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

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
                `📚 RAG Knowledge Base Statistics:\n\n` +
                    `📄 Total Documents: ${stats.totalDocuments}\n` +
                    `📝 Total Chunks: ${stats.totalChunks}\n\n` +
                    `The system will search through these documents first before using general knowledge to answer your questions.`
            );
        } catch (error) {
            console.error("❌ Error getting RAG stats:", error);

            // Track error
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
        const inputIcon = "🎤";

        const thinkingMessage = await ctx.reply("💬 Thinking...");

        try {
            const result = await this.processorService.processVoiceMessage(
                userId,
                fileLink.href,
                ctx
            );
            await this.sendAudioResponse(ctx, userId, result, "voice");
            await ctx.deleteMessage(thinkingMessage.message_id);
        } catch (error) {
            console.error("Voice processing error:", error);

            // Track error
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
