import { Telegraf, Context } from "telegraf";
import { createReadStream } from "fs";
import { BhashiniService } from "../services/bhashini";
import { OpenAIService } from "../services/openai";
import { UserStateService } from "../services/userState";
import { ProcessorService } from "../services/processor";
import { cleanupFiles, ensureDirectoryExists } from "../utils/file";
import { config } from "../config";
import { InputType } from "../types";

export class BotController {
    private bot: Telegraf;
    private bhashiniService: BhashiniService;
    private openaiService: OpenAIService;
    private userStateService: UserStateService;
    private processorService: ProcessorService;

    constructor() {
        this.bot = new Telegraf(config.telegramBotToken);
        this.bhashiniService = new BhashiniService();
        this.openaiService = new OpenAIService();
        this.userStateService = new UserStateService();
        this.processorService = new ProcessorService(
            this.bhashiniService,
            this.openaiService,
            this.userStateService
        );

        this.setupHandlers();
        ensureDirectoryExists(config.tempDir);
    }

    private setupHandlers(): void {
        this.setupCommands();
        this.setupCallbackQueries();
        this.setupMessageHandlers();
    }

    private setupCommands(): void {
        this.bot.start((ctx) => this.handleStart(ctx));
        this.bot.command("change_language", (ctx) =>
            this.handleChangeLanguage(ctx)
        );
    }

    private setupCallbackQueries(): void {
        this.bot.action("select_input", (ctx) => this.handleSelectInput(ctx));
        this.bot.action("select_output", (ctx) => this.handleSelectOutput(ctx));
        this.bot.action("input_hindi", (ctx) => this.handleInputHindi(ctx));
        this.bot.action("input_english", (ctx) => this.handleInputEnglish(ctx));
        this.bot.action("input_assamese", (ctx) =>
            this.handleInputAssamese(ctx)
        );
        this.bot.action("output_hindi", (ctx) => this.handleOutputHindi(ctx));
        this.bot.action("output_english", (ctx) =>
            this.handleOutputEnglish(ctx)
        );
        this.bot.action("output_assamese", (ctx) =>
            this.handleOutputAssamese(ctx)
        );
        this.bot.action("view_settings", (ctx) => this.handleViewSettings(ctx));
        this.bot.action("back_to_main", (ctx) => this.handleBackToMain(ctx));
    }

    private setupMessageHandlers(): void {
        this.bot.on("text", (ctx) => this.handleTextMessage(ctx));
        this.bot.on("voice", (ctx) => this.handleVoiceMessage(ctx));
    }

    private async handleStart(ctx: Context): Promise<void> {
        const userId = ctx.from?.id;
        if (!userId) return;

        this.userStateService.setUserSettings(userId, {
            input: "hindi",
            output: "hindi",
        });

        await ctx.reply(
            "🎙️ Welcome to VocalPipe - Ultimate Voice & Text AI Bot!\n\n" +
                "🗣️ Send me a voice message OR type a text message and I will respond with AI-generated audio!\n\n" +
                "🌐 Default: Hindi Input → Hindi Output\n" +
                "Use /change_language to customize both input and output languages.\n\n" +
                "📝 Available input methods:\n" +
                "• 🎤 Voice messages in your selected language\n" +
                "• ⌨️ Text messages in your selected language\n\n" +
                "🔊 Available workflows:\n" +
                "• 🇮🇳→🇮🇳 Hindi Text/Voice → GPT → Hindi Voice\n" +
                "• 🇺🇸→🇺🇸 English Text/Voice → GPT → English Voice\n" +
                "• 🇮🇳→🇺🇸 Hindi Text/Voice → GPT → English Voice\n" +
                "• 🇺🇸→🇮🇳 English Text/Voice → GPT → Hindi Voice\n" +
                "• 🇮🇳→🇮🇳 Assamese Text/Voice → GPT → Assamese Voice\n" +
                "• 🇮🇳→🇺🇸 Assamese Text/Voice → GPT → English Voice\n" +
                "• 🇺🇸→🇮🇳 English Text/Voice → GPT → Assamese Voice\n" +
                "• 🇮🇳→🇮🇳 Hindi Text/Voice → GPT → Assamese Voice"
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

        this.userStateService.setInputLanguage(userId, "hindi");
        await ctx.answerCbQuery();

        const settings = this.userStateService.getUserSettings(userId);
        const { inputFlag, outputFlag } =
            this.userStateService.getLanguageFlags(settings);

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

        try {
            const result = await this.processorService.processVoiceMessage(
                userId,
                fileLink.href
            );
            await this.sendAudioResponse(ctx, userId, result, "voice");
        } catch (error) {
            console.error("Voice processing error:", error);
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
                inputText
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

            await ctx.replyWithVoice(
                { source: createReadStream(oggPath) },
                { caption }
            );
        } finally {
            cleanupFiles([oggPath]);
        }
    }

    public launch(): void {
        this.bot.launch();
        console.log("🎙️ VocalPipe Bot is running...");
    }

    public stop(): void {
        this.bot.stop();
    }
}
