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

        // Initialize database connection
        await databaseService.connect();
        console.log("📊 Database connection established");

        // Initialize and launch bot
        const botController = new BotController();
        botController.launch();

        // Graceful shutdown
        process.once("SIGINT", async () => {
            console.log("🛑 Received SIGINT, shutting down gracefully...");
            await botController.stop();
            await databaseService.disconnect();
            process.exit(0);
        });

        process.once("SIGTERM", async () => {
            console.log("🛑 Received SIGTERM, shutting down gracefully...");
            await botController.stop();
            await databaseService.disconnect();
            process.exit(0);
        });
    } catch (error) {
        console.error("❌ Failed to start VocalPipe Bot:", error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    process.exit(1);
});

main();
