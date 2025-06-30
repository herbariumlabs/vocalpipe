# Documents Directory

This directory contains documents for the RAG (Retrieval-Augmented Generation) knowledge base used by VocalPipe.

## Structure

- `research/` - Research papers and academic documents
- `guides/` - User guides and documentation
- `reference/` - Reference materials and technical documentation

## Supported Formats

The RAG system currently supports:

- Markdown (.md) files
- Text (.txt) files
- PDF files (coming soon)

## Adding New Documents

1. Place your documents in the appropriate subdirectory
2. Use descriptive filenames
3. Ensure documents are well-formatted with clear headers and sections
4. The RAG system will automatically index new documents on restart

## Current Documents

### Research Papers

- `2008_Relative_abundance_of_different_stem_borer_species_in_Ahu_and_Sali_rice.md` - Research on rice stem borer species in Assam, India

## RAG Behavior

When users ask questions:

1. The system first searches through these local documents
2. If relevant information is found, it uses that as the primary source
3. If no relevant information is found, it falls back to the LLM's general knowledge
4. The system always cites sources when using document information
