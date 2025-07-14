# PostHog Analytics Setup Guide

## Overview

VocalPipe integrates with PostHog to provide comprehensive analytics and insights into user behavior, bot performance, and RAG system usage.

## Setup Instructions

### 1. Create PostHog Account

1. Visit [PostHog](https://posthog.com) and create an account
2. Create a new project for VocalPipe
3. Copy your Project API Key and Host URL

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```env
# PostHog Analytics (Optional)
POSTHOG_API_KEY=your_posthog_api_key_here
POSTHOG_HOST=https://us.i.posthog.com
```

**Note**: If you don't provide these values, analytics will be disabled automatically.

### 3. Verify Setup

1. Start your bot
2. Send a few test messages
3. Check your PostHog dashboard for incoming events

## Tracked Events

See [ANALYTICS_EVENTS.md](./ANALYTICS_EVENTS.md) for a complete list of tracked events and their properties.

## Privacy Considerations

- **No message content** is tracked
- Only metadata like message length, processing time, and language settings
- User IDs are Telegram user IDs (not personally identifiable without Telegram access)
- All tracking respects user privacy while providing valuable insights

## Usage Analytics

The analytics help you understand:

- **User Engagement**: How often users interact with the bot
- **Performance**: Response times and error rates
- **Language Preferences**: Most popular input/output language combinations
- **RAG Effectiveness**: How often the knowledge base provides relevant information

## Cost Optimization

### RAG System Update (July 2024)

**IMPORTANT**: VocalPipe now uses a **local TF-IDF search system** instead of OpenAI embeddings for document retrieval. This change eliminates embedding costs while maintaining search effectiveness.

#### Previous System (Expensive):

- Used OpenAI `text-embedding-3-small` for document embeddings
- Cost: ~12 million tokens for 47,567 document chunks
- Additional cost for every search query

#### New System (Zero Cost):

- Local TF-IDF (Term Frequency-Inverse Document Frequency) algorithm
- Fuzzy string matching for enhanced relevance
- **Zero OpenAI tokens used for search**
- Faster initialization and search times

#### Performance Comparison:

- **Cost**: 100% reduction in embedding costs (from millions of tokens to zero)
- **Speed**: 3-5x faster search (no API calls)
- **Accuracy**: Maintains high relevance with keyword-based matching
- **Scalability**: Better performance with large document sets

This optimization saves significant costs while maintaining the RAG system's effectiveness for agricultural document retrieval.
