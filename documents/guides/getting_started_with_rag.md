# Getting Started with RAG in VocalPipe

## What is RAG?

RAG (Retrieval-Augmented Generation) is a technique that enhances AI responses by first searching through a knowledge base of documents before generating answers. This allows the AI to provide more accurate, contextual, and up-to-date information.

## How RAG Works in VocalPipe

1. **Document Indexing**: All documents in the `documents/` directory are automatically loaded and indexed when the bot starts.

2. **Query Processing**: When you ask a question:

    - The system first searches through indexed documents for relevant information
    - If relevant documents are found, they are used as context for the AI response
    - If no relevant documents are found, the AI uses its general knowledge

3. **Source Citation**: When the AI uses information from documents, it cites the sources in its response.

## Document Organization

The documents are organized in the following structure:

- `documents/research/` - Research papers and academic documents
- `documents/guides/` - User guides and tutorials
- `documents/reference/` - Reference materials and technical documentation

## Supported File Types

Currently supported document formats:

- Markdown (.md) files
- Plain text (.txt) files

## Adding New Documents

To add new documents to the knowledge base:

1. Place your document in the appropriate subdirectory under `documents/`
2. Use descriptive filenames
3. Ensure documents are well-formatted with clear headers and sections
4. Restart the bot to index new documents

## RAG Commands

- `/rag_stats` - View knowledge base statistics (number of documents and chunks)

## Example Usage

Ask questions like:

- "What are the main species of rice stem borers in Assam?"
- "How do you control rice stem borers?"
- "What is the lifecycle of Scirpophaga innotata?"

The system will search through the research documents first and provide accurate, cited information.
