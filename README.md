# VocalPipe 🎙️

Advanced multilingual voice and text AI bot with dual language support and RAG (Retrieval-Augmented Generation) capabilities for Telegram.

## Features

- 🎤 **Voice Input**: Send voice messages in Hindi or English
- ⌨️ **Text Input**: Type messages in Hindi or English
- 🔊 **Voice Output**: Get AI responses as voice messages in Hindi or English
- 🌐 **Dual Language Selection**: Choose both input and output languages independently
- 🤖 **AI-Powered**: Uses GPT-4o-mini for intelligent responses
- 📚 **RAG System**: Search local documents first, then fallback to general knowledge
- 🖼️ **Image Analysis**: YOLOv8 models for oyster mushroom disease classification and stage detection
- 🔄 **Real-time Translation**: Seamless translation between Hindi and English
- 📱 **Telegram Integration**: Easy-to-use Telegram bot interface
- 📊 **Analytics**: Comprehensive PostHog analytics for user tracking and bot performance
- 🔍 **Error Monitoring**: Full Sentry integration for error tracking and performance monitoring
- 💰 **Cost-Optimized**: Local search eliminates expensive embedding costs

## New RAG Capabilities

VocalPipe now includes a powerful RAG (Retrieval-Augmented Generation) system that:

- 📖 **Searches Local Documents**: Automatically indexes and searches through documents in the `datasets/` directory
- 🎯 **Contextual Responses**: Provides more accurate answers by referencing relevant documents
- 📝 **Source Citation**: Cites document sources when using information from the knowledge base
- 🔍 **Intelligent Fallback**: Uses general AI knowledge when no relevant documents are found
- 📊 **Statistics Tracking**: Monitor knowledge base size and usage with `/rag_stats`
- 💡 **Zero Embedding Costs**: Uses local TF-IDF search instead of expensive OpenAI embeddings

## Document Structure

```
datasets/
├── Assam Law and Policy/              # Assam-specific policies, schemes, guidelines
├── Government of India Law and Policy/ # Central/Federal programs and policies
└── ...                                # Additional curated corpora
```

## Supported Workflows

1. **🇮🇳→🇮🇳** Hindi Text/Voice → RAG Search → GPT → Hindi Voice
2. **🇺🇸→🇺🇸** English Text/Voice → RAG Search → GPT → English Voice
3. **🇮🇳→🇺🇸** Hindi Text/Voice → RAG Search → GPT → English Voice
4. **🇺🇸→🇮🇳** English Text/Voice → RAG Search → GPT → Hindi Voice

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+ (for ML models)
- FFmpeg installed on your system
- Telegram Bot Token
- OpenAI API Key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vocalpipe

# Install Node.js dependencies
npm install

# Install Python dependencies (for ML models)
pip3 install -r requirements.txt

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

# Optional: Analytics (PostHog)
POSTHOG_API_KEY=your_posthog_api_key_here
POSTHOG_HOST=https://us.i.posthog.com

# Optional: Error Monitoring (Sentry)
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENVIRONMENT=development
SENTRY_ENABLE_PROFILING=true
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILES_SAMPLE_RATE=1.0

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
2. Use `/start` to initialize and see RAG statistics
3. Use `/change_language` to set input and output languages
4. Use `/rag_stats` to check knowledge base status
5. Send voice messages or text messages in your selected language
6. Receive AI-generated voice responses with RAG-enhanced accuracy!

## Commands

- `/start` - Initialize the bot and see welcome message with RAG stats
- `/change_language` - Open language settings menu
- `/rag_stats` - View knowledge base statistics

## Image Analysis

Send any image of oyster mushrooms to get:

- **Disease Classification**: Identifies diseases with confidence scores
- **Stage Detection**: Detects growth stages with bounding boxes
- **Annotated Image**: Visual representation of detected stages

Powered by YOLOv8 models trained specifically for oyster mushroom analysis.

## Adding Documents to RAG

1. Place documents in the appropriate `datasets/` subdirectory:
    - `datasets/Assam Law and Policy/` for Assam-specific content
    - `datasets/Government of India Law and Policy/` for central content

2. Supported formats: `.md`, `.txt`

3. Restart the bot to index new documents

4. The system will automatically:
    - Load and chunk documents
    - Build local search index (NO OpenAI cost!)
    - Enable semantic search

## Architecture

```
src/
├── controllers/     # Bot controllers and handlers
├── services/        # Business logic services
│   ├── rag.ts      # RAG system implementation
│   ├── openai.ts   # OpenAI integration with RAG
│   └── ...
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── config/         # Configuration management
└── index.ts        # Application entry point
datasets/           # RAG knowledge base
├── Assam Law and Policy/              # Assam-specific corpus
├── Government of India Law and Policy/# Central/Federal corpus
└── ...
```

## Technologies

- **TypeScript** - Type-safe development
- **Telegraf** - Telegram bot framework
- **OpenAI API** - AI responses and English TTS
- **LangChain** - Document processing and chat models
- **Bhashini API** - Hindi ASR, translation, and TTS
- **FFmpeg** - Audio processing
- **Jest** - Testing framework
- **TF-IDF** - Local document search (cost-optimized)
- **Sentry** - Error tracking and performance monitoring
- **Prisma** - Database ORM for PostgreSQL
- **PostHog** - Product analytics

## RAG System Details

The RAG system works by:

1. **Document Loading**: Recursively scans the `datasets/` directory for supported files
2. **Text Chunking**: Splits documents into 1000-character chunks with 200-character overlap
3. **Local Indexing**: Uses TF-IDF (Term Frequency-Inverse Document Frequency) algorithm
4. **Semantic Search**: Calculates relevance scores with fuzzy matching
5. **Context Injection**: Adds relevant documents to the system prompt
6. **Source Citation**: Includes document sources in AI responses

### Cost Optimization (July 2024)

**MAJOR UPDATE**: The RAG system now uses **local TF-IDF search** instead of OpenAI embeddings:

- ✅ **Zero OpenAI tokens** used for document search
- ✅ **3-5x faster** search performance (no API calls)
- ✅ **Better scalability** with large document sets
- ✅ **Maintains high relevance** with keyword-based matching

**Previous Cost**: ~12 million OpenAI tokens for 47,567 document chunks
**New Cost**: **Zero tokens** for search operations

## Example RAG Queries

Try asking questions like:

- "What are the main rice stem borer species in Assam?"
- "What percentage of stem borers are Scirpophaga innotata?"
- "Which season has higher borer populations?"
- "What is the Chief Minister's Floriculture Mission?"
- "How does PMFBY work in Assam?"
- "What are the guidelines for organic farming under PKVY?"

## Performance Metrics

Current system handles:

- **122 documents** (Assam + Central + Research + Guides)
- **47,567 text chunks** for comprehensive coverage
- **Zero embedding costs** with local search
- **Average 785ms** response time per query
- **100% success rate** in document retrieval

## Monitoring & Observability

VocalPipe includes comprehensive monitoring with Sentry:

- **Error Tracking**: Automatic capture of all errors with full context
- **Performance Monitoring**: Track response times, database queries, and API calls
- **Profiling**: CPU and memory profiling to identify bottlenecks
- **User Context**: Track which users encounter issues
- **Breadcrumbs**: Detailed debugging trails for every error
- **Custom Metrics**: Track RAG performance, processing times, and more

See [SENTRY_INTEGRATION.md](docs/SENTRY_INTEGRATION.md) for detailed documentation.

### Testing Sentry Integration

```bash
# Run Sentry integration tests
npm run test:sentry
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
