# Analytics Events Reference

This document provides a detailed reference of all analytics events tracked by VocalPipe.

## Event Structure

All events follow a consistent structure:

```typescript
{
  distinctId: "telegram_<userId>",  // User identifier
  event: "event_name",              // Event name
  properties: {
    // Common properties (all events)
    platform: "telegram",
    username: string,
    firstName: string,
    lastName: string,
    userId: number,
    timestamp: string,

    // Event-specific properties
    ...
  }
}
```

## Event Types

### 1. User Engagement Events

#### `bot_started`

Tracks when a user starts the bot with `/start`

```typescript
{
  event: "bot_started",
  properties: {
    // Only common properties
  }
}
```

#### `user_session`

Tracks user session information

```typescript
{
  event: "user_session",
  properties: {
    sessionDurationMs?: number  // Session duration in milliseconds
  }
}
```

### 2. Message Processing Events

#### `message_processed`

Master event for all message processing

```typescript
{
  event: "message_processed",
  properties: {
    inputType: "text" | "voice",
    inputLanguage: "hindi" | "english" | "assamese" | "punjabi",
    outputLanguage: "hindi" | "english" | "assamese" | "punjabi",
    messageLength: number,        // Characters in input message
    hasRAGContext: boolean,       // Whether RAG found relevant docs
    ragDocumentsFound: number,    // Number of relevant documents
    processingTimeMs: number      // Total processing time
  }
}
```

#### `text_message_received`

Specific to text messages

```typescript
{
  event: "text_message_received",
  properties: {
    inputLanguage: string,
    outputLanguage: string,
    messageLength: number,
    processingTimeMs: number,
    hasRAGContext: boolean,
    ragDocumentsFound: number
  }
}
```

#### `voice_message_received`

Specific to voice messages

```typescript
{
  event: "voice_message_received",
  properties: {
    inputLanguage: string,
    outputLanguage: string,
    processingTimeMs: number,     // Includes STT + AI + TTS time
    hasRAGContext: boolean,
    ragDocumentsFound: number
  }
}
```

### 3. Language Configuration Events

#### `language_changed`

Tracks language preference changes

```typescript
{
  event: "language_changed",
  properties: {
    changeType: "input" | "output" | "both",
    previousInputLanguage?: string,
    previousOutputLanguage?: string,
    newInputLanguage?: string,
    newOutputLanguage?: string
  }
}
```

#### `callback_query_executed`

Tracks inline keyboard interactions

```typescript
{
  event: "callback_query_executed",
  properties: {
    callbackData: string  // The callback data from the button
  }
}
```

### 4. RAG System Events

#### `rag_query_executed`

Tracks RAG system searches

```typescript
{
  event: "rag_query_executed",
  properties: {
    queryLength: number,      // Length of search query
    documentsFound: number,   // Number of documents found
    relevantChunks: number,   // Number of relevant chunks
    hasResults: boolean       // Whether any results were found
  }
}
```

#### `rag_stats_viewed`

Tracks when users check RAG statistics

```typescript
{
  event: "rag_stats_viewed",
  properties: {
    // Only common properties
  }
}
```

### 5. Error Events

#### `error_occurred`

Tracks all errors in the system

```typescript
{
  event: "error_occurred",
  properties: {
    errorType: string,        // Type of error (e.g., "voice_processing_error")
    errorMessage: string,     // Error message
    context: string          // Where the error occurred
  }
}
```

## Event Frequency

| Event                     | Frequency             | Description              |
| ------------------------- | --------------------- | ------------------------ |
| `bot_started`             | Once per user session | New user or restart      |
| `message_processed`       | Per message           | Every user message       |
| `text_message_received`   | Per text message      | Text input only          |
| `voice_message_received`  | Per voice message     | Voice input only         |
| `language_changed`        | When changed          | Language setting updates |
| `callback_query_executed` | Per button click      | UI interactions          |
| `rag_query_executed`      | Per message           | RAG searches             |
| `rag_stats_viewed`        | When requested        | `/rag_stats` command     |
| `error_occurred`          | When errors happen    | Error tracking           |
| `user_session`            | Periodically          | Session analytics        |

## Privacy Notes

- **No message content** is tracked - only metadata like length and language
- **User identification** uses Telegram public data only
- **Error messages** may contain technical details but no personal data
- **Processing times** help optimize performance
- **RAG queries** track query length but not content

## Dashboard Metrics

### Key Performance Indicators (KPIs)

1. **User Engagement**

    - Daily/Monthly Active Users
    - Messages per user
    - Session duration

2. **Language Usage**

    - Input language distribution
    - Output language distribution
    - Language change patterns

3. **Processing Performance**

    - Average processing time by input type
    - Error rates by operation
    - RAG hit rate

4. **RAG Effectiveness**
    - Percentage of queries with relevant results
    - Average documents found per query
    - Most searched topics

### Sample PostHog Queries

#### Daily Active Users

```
event = 'bot_started'
group by day
```

#### Most Popular Language Combinations

```
event = 'message_processed'
group by properties.inputLanguage, properties.outputLanguage
```

#### Processing Time Analysis

```
event = 'message_processed'
aggregate avg(properties.processingTimeMs)
group by properties.inputType
```

#### RAG Success Rate

```
event = 'rag_query_executed'
filter properties.hasResults = true
percentage of total rag_query_executed events
```

#### Error Rate by Type

```
event = 'error_occurred'
group by properties.errorType
count events per day
```

## Implementation Example

```typescript
// Track a message processing event
await analyticsService.trackMessageProcessing({
    userId: 12345,
    username: "john_doe",
    firstName: "John",
    lastName: "Doe",
    inputType: "text",
    inputLanguage: "hindi",
    outputLanguage: "english",
    messageLength: 42,
    hasRAGContext: true,
    ragDocumentsFound: 3,
    processingTimeMs: 1250,
});
```

This creates an event that helps track:

- User behavior patterns
- Performance metrics
- RAG system effectiveness
- Language preferences
- Error rates and types
