import { BotController } from './controllers/bot';
import { config, validateConfig } from './config';

async function main(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();
    
    console.log('🚀 Starting VocalPipe Bot...');
    console.log(`📝 Environment: ${config.nodeEnv}`);
    console.log(`📁 Temp Directory: ${config.tempDir}`);
    
    // Initialize and launch bot
    const botController = new BotController();
    botController.launch();
    
    // Graceful shutdown
    process.once('SIGINT', () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      botController.stop();
      process.exit(0);
    });
    
    process.once('SIGTERM', () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      botController.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start VocalPipe Bot:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

main();
