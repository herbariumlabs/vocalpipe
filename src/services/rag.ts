import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { Document } from "@langchain/core/documents";

// Simple text splitter implementation
class SimpleTextSplitter {
    private chunkSize: number;
    private chunkOverlap: number;

    constructor(options: { chunkSize: number; chunkOverlap: number }) {
        this.chunkSize = options.chunkSize;
        this.chunkOverlap = options.chunkOverlap;
    }

    async splitDocuments(documents: Document[]): Promise<Document[]> {
        const chunks: Document[] = [];

        for (const doc of documents) {
            const text = doc.pageContent;
            const docChunks = this.splitText(text);

            for (let i = 0; i < docChunks.length; i++) {
                chunks.push(
                    new Document({
                        pageContent: docChunks[i],
                        metadata: { ...doc.metadata, chunk: i },
                    })
                );
            }
        }

        return chunks;
    }

    private splitText(text: string): string[] {
        const chunks: string[] = [];
        let start = 0;

        while (start < text.length) {
            let end = Math.min(start + this.chunkSize, text.length);

            // Try to break at a sentence or paragraph boundary
            if (end < text.length) {
                const lastPeriod = text.lastIndexOf(".", end);
                const lastNewline = text.lastIndexOf("\n", end);
                const breakPoint = Math.max(lastPeriod, lastNewline);

                if (breakPoint > start) {
                    end = breakPoint + 1;
                }
            }

            chunks.push(text.slice(start, end).trim());
            start = Math.max(start + 1, end - this.chunkOverlap);
        }

        return chunks.filter((chunk) => chunk.length > 0);
    }
}

// TF-IDF implementation for local search (NO OPENAI COST!)
class TFIDFSearchEngine {
    private documents: DocumentChunk[] = [];
    private vocabulary: Set<string> = new Set();
    private termFrequency: Map<string, Map<string, number>> = new Map();
    private documentFrequency: Map<string, number> = new Map();
    private idf: Map<string, number> = new Map();

    private tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter((word) => word.length > 2); // Filter out very short words
    }

    private calculateTF(terms: string[]): Map<string, number> {
        const tf = new Map<string, number>();
        const totalTerms = terms.length;

        for (const term of terms) {
            tf.set(term, (tf.get(term) || 0) + 1);
        }

        // Normalize by total terms
        for (const [term, count] of tf) {
            tf.set(term, count / totalTerms);
        }

        return tf;
    }

    addDocuments(documents: DocumentChunk[]): void {
        this.documents = documents;

        // Build vocabulary and calculate term frequencies
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const terms = this.tokenize(doc.content);
            const tf = this.calculateTF(terms);

            this.termFrequency.set(i.toString(), tf);

            // Add to vocabulary and track document frequency
            const uniqueTerms = new Set(terms);
            for (const term of uniqueTerms) {
                this.vocabulary.add(term);
                this.documentFrequency.set(
                    term,
                    (this.documentFrequency.get(term) || 0) + 1
                );
            }
        }

        // Calculate IDF
        const totalDocs = documents.length;
        for (const term of this.vocabulary) {
            const df = this.documentFrequency.get(term) || 1;
            this.idf.set(term, Math.log(totalDocs / df));
        }
    }

    search(query: string, limit: number = 3): DocumentChunk[] {
        if (this.documents.length === 0) return [];

        const queryTerms = this.tokenize(query);
        const scores: Array<{ document: DocumentChunk; score: number }> = [];

        for (let i = 0; i < this.documents.length; i++) {
            let score = 0;
            const tf = this.termFrequency.get(i.toString()) || new Map();

            for (const term of queryTerms) {
                const termTF = tf.get(term) || 0;
                const termIDF = this.idf.get(term) || 0;
                score += termTF * termIDF;
            }

            // Add fuzzy matching bonus for partial matches
            const content = this.documents[i].content.toLowerCase();
            for (const term of queryTerms) {
                if (content.includes(term)) {
                    score += 0.1; // Small bonus for exact substring match
                }
            }

            if (score > 0) {
                scores.push({ document: this.documents[i], score });
            }
        }

        // Sort by score and return top results
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, limit).map((result) => result.document);
    }
}

interface DocumentChunk {
    content: string;
    metadata: {
        source: string;
        chunk: number;
    };
}

export class RAGService {
    private searchEngine: TFIDFSearchEngine;
    private documents: DocumentChunk[] = [];
    private textSplitter: SimpleTextSplitter;
    private documentsPath: string;
    private initialized = false;

    constructor() {
        // NO MORE OPENAI EMBEDDINGS! Using local TF-IDF search instead
        this.searchEngine = new TFIDFSearchEngine();

        this.textSplitter = new SimpleTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        this.documentsPath = join(process.cwd(), "documents");
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log(
            "🔄 Initializing RAG system with LOCAL SEARCH (NO OpenAI cost)..."
        );
        try {
            await this.loadDocuments();
            this.buildSearchIndex();
            this.initialized = true;
            console.log(
                `✅ RAG system initialized with ${this.documents.length} document chunks (ZERO embedding cost!)`
            );
        } catch (error) {
            console.error("❌ Failed to initialize RAG system:", error);
            throw error;
        }
    }

    private async loadDocuments(): Promise<void> {
        const documents: Document[] = [];

        try {
            await this.loadDocumentsFromDirectory(
                this.documentsPath,
                documents
            );
        } catch (error) {
            console.warn(
                "⚠️ Documents directory not found, creating empty RAG store"
            );
            return;
        }

        // Split documents into chunks
        const chunks: Document[] = [];
        for (const doc of documents) {
            const splitDocs = await this.textSplitter.splitDocuments([doc]);
            chunks.push(...splitDocs);
        }

        // Convert to our internal format (NO EMBEDDINGS!)
        this.documents = chunks.map((chunk, index) => ({
            content: chunk.pageContent,
            metadata: {
                source: chunk.metadata.source || "unknown",
                chunk: index,
            },
        }));

        console.log(
            `📚 Loaded ${documents.length} documents, split into ${chunks.length} chunks`
        );
    }

    private async loadDocumentsFromDirectory(
        dirPath: string,
        documents: Document[]
    ): Promise<void> {
        const files = readdirSync(dirPath);

        for (const file of files) {
            const filePath = join(dirPath, file);
            const stat = statSync(filePath);

            if (stat.isDirectory()) {
                await this.loadDocumentsFromDirectory(filePath, documents);
            } else if (this.isSupportedFile(file)) {
                try {
                    const content = this.loadFileContent(filePath);
                    if (content.trim()) {
                        documents.push(
                            new Document({
                                pageContent: content,
                                metadata: { source: filePath },
                            })
                        );
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to load file ${filePath}:`, error);
                }
            }
        }
    }

    private isSupportedFile(filename: string): boolean {
        const ext = extname(filename).toLowerCase();
        return [".md", ".txt"].includes(ext);
    }

    private loadFileContent(filePath: string): string {
        return readFileSync(filePath, "utf-8");
    }

    private buildSearchIndex(): void {
        if (this.documents.length === 0) {
            console.log("📝 No documents to index");
            return;
        }

        console.log("🔄 Building local search index (NO OpenAI cost)...");
        this.searchEngine.addDocuments(this.documents);
        console.log("✅ Search index built successfully");
    }

    async searchDocuments(
        query: string,
        limit: number = 3
    ): Promise<DocumentChunk[]> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.documents.length === 0) {
            return [];
        }

        try {
            // Use local TF-IDF search (NO OPENAI COST!)
            const relevantResults = this.searchEngine.search(query, limit);

            console.log(
                `🔍 Found ${relevantResults.length} relevant documents for query: "${query}" (ZERO cost search!)`
            );

            return relevantResults;
        } catch (error) {
            console.error("❌ Error searching documents:", error);
            return [];
        }
    }

    async addDocument(content: string, source: string): Promise<void> {
        try {
            const document = new Document({
                pageContent: content,
                metadata: { source },
            });

            const chunks = await this.textSplitter.splitDocuments([document]);

            const newChunks: DocumentChunk[] = chunks.map(
                (chunk: Document, index: number) => ({
                    content: chunk.pageContent,
                    metadata: {
                        source,
                        chunk: this.documents.length + index,
                    },
                })
            );

            this.documents.push(...newChunks);

            // Rebuild search index with new documents (still NO OpenAI cost!)
            this.buildSearchIndex();

            console.log(
                `📄 Added document "${source}" with ${newChunks.length} chunks (ZERO embedding cost!)`
            );
        } catch (error) {
            console.error("❌ Failed to add document:", error);
            throw error;
        }
    }

    getDocumentStats(): { totalDocuments: number; totalChunks: number } {
        const uniqueSources = new Set(
            this.documents.map((doc) => doc.metadata.source)
        );
        return {
            totalDocuments: uniqueSources.size,
            totalChunks: this.documents.length,
        };
    }
}
