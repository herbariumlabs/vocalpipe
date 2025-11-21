import { config as dotenvConfig } from "dotenv";
import { AppConfig } from "../types";

dotenvConfig();

export const config: AppConfig = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    nodeEnv: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "3000", 10),
    tempDir: process.env.TEMP_DIR || "./tmp",
    logLevel: process.env.LOG_LEVEL || "info",
    posthogApiKey: process.env.POSTHOG_API_KEY,
    posthogHost: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    databaseUrl: process.env.DATABASE_URL,
    sentryDsn: process.env.SENTRY_DSN,
    sentryEnvironment: process.env.SENTRY_ENVIRONMENT || "development",
    sentryEnableProfiling: process.env.SENTRY_ENABLE_PROFILING === "true",
    sentryTracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "1.0"),
    sentryProfilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "1.0"),
};

export const validateConfig = (): void => {
    const requiredFields: (keyof AppConfig)[] = [
        "telegramBotToken",
        "openaiApiKey",
    ];

    for (const field of requiredFields) {
        if (!config[field]) {
            throw new Error(
                `Missing required environment variable: ${field.toUpperCase()}`
            );
        }
    }
};
