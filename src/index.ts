// Import Sentry instrumentation FIRST before any other modules
import { Sentry } from "./instrument";
import { logger } from "./services/logger";
import { BotController } from "./controllers/bot";
import { config, validateConfig } from "./config";
import { databaseService } from "./services/database";

async function main(): Promise<void> {
    try {
        // Validate configuration
        validateConfig();

        console.log("🚀 Starting VocalPipe Bot...");
        console.log(`📝 Environment: ${config.nodeEnv}`);
        console.log(`📁 Temp Directory: ${config.tempDir}`);

        logger.info("VocalPipe Bot starting", {
            environment: config.nodeEnv,
            tempDir: config.tempDir,
            hasTelegramToken: !!config.telegramBotToken,
            hasOpenAIKey: !!config.openaiApiKey,
            hasPostHog: !!config.posthogApiKey,
            hasSentry: !!config.sentryDsn,
            hasDatabase: !!config.databaseUrl,
        });

        // Initialize database connection
        await databaseService.connect();
        console.log("📊 Database connection established");

        logger.info("Database connection established");

        // Initialize and launch bot
        const botController = new BotController();
        await botController.launch();

        logger.info("VocalPipe Bot launched successfully");

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`🛑 Received ${signal}, shutting down gracefully...`);
            logger.warn(logger.fmt`Shutdown signal received: ${signal}`);

            try {
                await botController.stop();
                await databaseService.disconnect();

                // Flush Sentry events before exiting
                if (config.sentryDsn) {
                    console.log("📤 Flushing Sentry events...");
                    await Sentry.flush(2000);
                }

                console.log("✅ Graceful shutdown complete");
                logger.info("Graceful shutdown completed successfully");
                process.exit(0);
            } catch (error) {
                console.error("❌ Error during shutdown:", error);
                logger.error("Error during shutdown", {
                    error:
                        error instanceof Error ? error.message : String(error),
                });
                Sentry.captureException(error);
                await Sentry.flush(2000);
                process.exit(1);
            }
        };

        process.once("SIGINT", () => shutdown("SIGINT"));
        process.once("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
        console.error("❌ Failed to start VocalPipe Bot:", error);
        logger.fatal("Failed to start VocalPipe Bot", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        Sentry.captureException(error, {
            tags: {
                context: "startup",
                fatal: true,
            },
        });
        await Sentry.flush(2000);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);

    logger.error("Unhandled promise rejection", {
        reason: String(reason),
        promise: String(promise),
    });

    Sentry.captureException(reason, {
        tags: {
            type: "unhandledRejection",
        },
        contexts: {
            promise: {
                promise: String(promise),
            },
        },
    });

    // Give Sentry time to send the error
    Sentry.flush(2000).then(() => {
        process.exit(1);
    });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);

    logger.fatal("Uncaught exception", {
        error: error.message,
        stack: error.stack,
    });

    Sentry.captureException(error, {
        tags: {
            type: "uncaughtException",
            fatal: true,
        },
    });

    // Give Sentry time to send the error
    Sentry.flush(2000).then(() => {
        process.exit(1);
    });
});

main();
