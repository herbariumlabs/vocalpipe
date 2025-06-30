# VocalPipe 🎙️

Advanced multilingual voice and text AI bot with dual language support and RAG (Retrieval-Augmented Generation) capabilities for Telegram.

## Features

- 🎤 **Voice Input**: Send voice messages in Hindi or English
- ⌨️ **Text Input**: Type messages in Hindi or English
- 🔊 **Voice Output**: Get AI responses as voice messages in Hindi or English
- 🌐 **Dual Language Selection**: Choose both input and output languages independently
- 🤖 **AI-Powered**: Uses GPT-4o-mini for intelligent responses
- 📚 **RAG System**: Search local documents first, then fallback to general knowledge
- 🔄 **Real-time Translation**: Seamless translation between Hindi and English
- 📱 **Telegram Integration**: Easy-to-use Telegram bot interface

## New RAG Capabilities

VocalPipe now includes a powerful RAG (Retrieval-Augmented Generation) system that:

- 📖 **Searches Local Documents**: Automatically indexes and searches through documents in the `documents/` directory
- 🎯 **Contextual Responses**: Provides more accurate answers by referencing relevant documents
- 📝 **Source Citation**: Cites document sources when using information from the knowledge base
- 🔍 **Intelligent Fallback**: Uses general AI knowledge when no relevant documents are found
- 📊 **Statistics Tracking**: Monitor knowledge base size and usage with `/rag_stats`

## Document Structure

```
documents/
├── README.md
├── research/           # Research papers and academic documents
│   └── 2008_Relative_abundance_of_different_stem_borer_species_in_Ahu_and_Sali_rice.md
├── guides/            # User guides and tutorials
│   └── getting_started_with_rag.md
└── reference/         # Reference materials and technical docs
```

## Supported Workflows

1. **🇮🇳→🇮🇳** Hindi Text/Voice → RAG Search → GPT → Hindi Voice
2. **🇺🇸→🇺🇸** English Text/Voice → RAG Search → GPT → English Voice
3. **🇮🇳→🇺🇸** Hindi Text/Voice → RAG Search → GPT → English Voice
4. **🇺🇸→🇮🇳** English Text/Voice → RAG Search → GPT → Hindi Voice

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
2. Use `/start` to initialize and see RAG statistics
3. Use `/change_language` to set input and output languages
4. Use `/rag_stats` to check knowledge base status
5. Send voice messages or text messages in your selected language
6. Receive AI-generated voice responses with RAG-enhanced accuracy!

## Commands

- `/start` - Initialize the bot and see welcome message with RAG stats
- `/change_language` - Open language settings menu
- `/rag_stats` - View knowledge base statistics

## Adding Documents to RAG

1. Place documents in the appropriate `documents/` subdirectory:

    - `documents/research/` for research papers
    - `documents/guides/` for user guides
    - `documents/reference/` for reference materials

2. Supported formats: `.md`, `.txt`

3. Restart the bot to index new documents

4. The system will automatically:
    - Load and chunk documents
    - Generate embeddings
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

documents/          # RAG knowledge base
├── research/       # Research papers
├── guides/         # User guides
└── reference/      # Reference materials
```

## Technologies

- **TypeScript** - Type-safe development
- **Telegraf** - Telegram bot framework
- **OpenAI API** - AI responses, embeddings, and English TTS
- **LangChain** - RAG implementation and document processing
- **Bhashini API** - Hindi ASR, translation, and TTS
- **FFmpeg** - Audio processing
- **Jest** - Testing framework

## RAG System Details

The RAG system works by:

1. **Document Loading**: Recursively scans the `documents/` directory for supported files
2. **Text Chunking**: Splits documents into 1000-character chunks with 200-character overlap
3. **Embedding Generation**: Uses OpenAI's `text-embedding-3-small` model
4. **Semantic Search**: Calculates cosine similarity between query and document embeddings
5. **Context Injection**: Adds relevant documents to the system prompt
6. **Source Citation**: Includes document sources in AI responses

## Example RAG Queries

Try asking questions like:

- "What are the main rice stem borer species in Assam?"
- "What percentage of stem borers are Scirpophaga innotata?"
- "Which season has higher borer populations?"

The system will search through research documents and provide cited, accurate answers.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
