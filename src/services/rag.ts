import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { config } from "../config";

// Simple text splitter implementation since RecursiveCharacterTextSplitter import is not available
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

interface DocumentChunk {
    content: string;
    metadata: {
        source: string;
        chunk: number;
    };
    embedding?: number[];
}

export class RAGService {
    private embeddings: OpenAIEmbeddings;
    private documents: DocumentChunk[] = [];
    private textSplitter: SimpleTextSplitter;
    private documentsPath: string;
    private initialized = false;

    constructor() {
        this.embeddings = new OpenAIEmbeddings({
            apiKey: config.openaiApiKey,
            model: "text-embedding-3-small",
        });

        this.textSplitter = new SimpleTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        this.documentsPath = join(process.cwd(), "documents");
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log("🔄 Initializing RAG system...");
        try {
            await this.loadDocuments();
            await this.generateEmbeddings();
            this.initialized = true;
            console.log(
                `✅ RAG system initialized with ${this.documents.length} document chunks`
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

        // Convert to our internal format
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
        const supportedExtensions = [".md", ".txt"];
        return supportedExtensions.includes(extname(filename).toLowerCase());
    }

    private loadFileContent(filePath: string): string {
        const extension = extname(filePath).toLowerCase();

        switch (extension) {
            case ".md":
            case ".txt":
                return readFileSync(filePath, "utf-8");
            default:
                throw new Error(`Unsupported file type: ${extension}`);
        }
    }

    private async generateEmbeddings(): Promise<void> {
        if (this.documents.length === 0) {
            console.log("📝 No documents to embed");
            return;
        }

        console.log("🔄 Generating embeddings...");

        try {
            const contents = this.documents.map((doc) => doc.content);
            const embeddings = await this.embeddings.embedDocuments(contents);

            for (let i = 0; i < this.documents.length; i++) {
                this.documents[i].embedding = embeddings[i];
            }

            console.log("✅ Embeddings generated successfully");
        } catch (error) {
            console.error("❌ Failed to generate embeddings:", error);
            throw error;
        }
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
            // Generate embedding for the query
            const queryEmbedding = await this.embeddings.embedQuery(query);

            // Calculate cosine similarity for each document
            const similarities = this.documents.map((doc) => ({
                document: doc,
                similarity: this.cosineSimilarity(
                    queryEmbedding,
                    doc.embedding!
                ),
            }));

            // Sort by similarity and return top results
            similarities.sort((a, b) => b.similarity - a.similarity);

            // Filter results with similarity above threshold
            const threshold = 0.5;
            const relevantResults = similarities
                .filter((result) => result.similarity > threshold)
                .slice(0, limit)
                .map((result) => result.document);

            console.log(
                `🔍 Found ${relevantResults.length} relevant documents for query: "${query}"`
            );

            return relevantResults;
        } catch (error) {
            console.error("❌ Error searching documents:", error);
            return [];
        }
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(
            a.reduce((sum, val) => sum + val * val, 0)
        );
        const magnitudeB = Math.sqrt(
            b.reduce((sum, val) => sum + val * val, 0)
        );

        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async addDocument(content: string, source: string): Promise<void> {
        try {
            const document = new Document({
                pageContent: content,
                metadata: { source },
            });

            const chunks = await this.textSplitter.splitDocuments([document]);
            const embeddings = await this.embeddings.embedDocuments(
                chunks.map((chunk: Document) => chunk.pageContent)
            );

            const newChunks: DocumentChunk[] = chunks.map(
                (chunk: Document, index: number) => ({
                    content: chunk.pageContent,
                    metadata: {
                        source,
                        chunk: this.documents.length + index,
                    },
                    embedding: embeddings[index],
                })
            );

            this.documents.push(...newChunks);
            console.log(
                `📄 Added document "${source}" with ${newChunks.length} chunks`
            );
        } catch (error) {
            console.error("❌ Failed to add document:", error);
            throw error;
        }
    }

    getDocumentStats(): { totalDocuments: number; totalChunks: number } {
        const sources = new Set(
            this.documents.map((doc) => doc.metadata.source)
        );
        return {
            totalDocuments: sources.size,
            totalChunks: this.documents.length,
        };
    }
}
