# VocalPipe 🎙️

Advanced multilingual voice and text AI bot with dual language support for Telegram.

## Features

- 🎤 **Voice Input**: Send voice messages in Hindi or English
- ⌨️ **Text Input**: Type messages in Hindi or English  
- 🔊 **Voice Output**: Get AI responses as voice messages in Hindi or English
- 🌐 **Dual Language Selection**: Choose both input and output languages independently
- 🤖 **AI-Powered**: Uses GPT-4o-mini for intelligent responses
- 🔄 **Real-time Translation**: Seamless translation between Hindi and English
- 📱 **Telegram Integration**: Easy-to-use Telegram bot interface

## Supported Workflows

1. **🇮🇳→🇮🇳** Hindi Text/Voice → GPT → Hindi Voice
2. **🇺🇸→🇺🇸** English Text/Voice → GPT → English Voice  
3. **🇮🇳→🇺🇸** Hindi Text/Voice → GPT → English Voice
4. **🇺🇸→🇮🇳** English Text/Voice → GPT → Hindi Voice

## Quick Start

### Prerequisites

- Node.js 18+
- FFmpeg installed on your system
- Telegram Bot Token
- OpenAI API Key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vocalpipe

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Configuration

Edit `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
```

### Development

```bash
# Run in development mode
npm run dev

# Run with auto-reload
npm run dev:watch

# Build for production
npm run build

# Run production build
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Usage

1. Start a chat with your bot on Telegram
2. Use `/start` to initialize
3. Use `/change_language` to set input and output languages
4. Send voice messages or text messages in your selected language
5. Receive AI-generated voice responses!

## Commands

- `/start` - Initialize the bot and see welcome message
- `/change_language` - Open language settings menu

## Architecture

```
src/
├── controllers/     # Bot controllers and handlers
├── services/        # Business logic services
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── config/         # Configuration management
└── index.ts        # Application entry point
```

## Technologies

- **TypeScript** - Type-safe development
- **Telegraf** - Telegram bot framework
- **OpenAI API** - AI responses and English TTS
- **Bhashini API** - Hindi ASR, translation, and TTS
- **FFmpeg** - Audio processing
- **Jest** - Testing framework

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
