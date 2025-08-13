import { readFileSync, readdirSync, lstatSync } from "fs";
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

// Enhanced Hybrid Search Engine (NO OPENAI COST!)
class EnhancedSearchEngine {
    private documents: DocumentChunk[] = [];
    private vocabulary: Set<string> = new Set();
    private phraseIndex: Map<string, Set<number>> = new Map();
    private wordIndex: Map<string, Set<number>> = new Map();
    private termFrequency: Map<string, Map<string, number>> = new Map();
    private documentFrequency: Map<string, number> = new Map();
    private idf: Map<string, number> = new Map();

    private tokenize(text: string): { words: string[]; phrases: string[] } {
        // Normalize text
        const normalized = text
            .toLowerCase()
            .replace(/[^\w\s']/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        // Extract individual words (filter short words)
        const words = normalized
            .split(/\s+/)
            .filter((word) => word.length > 2 && !this.isStopWord(word));

        // Extract meaningful phrases (2-4 words)
        const phrases: string[] = [];
        const wordArray = normalized.split(/\s+/);

        // 2-word phrases
        for (let i = 0; i < wordArray.length - 1; i++) {
            const phrase = `${wordArray[i]} ${wordArray[i + 1]}`;
            if (phrase.length > 5) phrases.push(phrase);
        }

        // 3-word phrases
        for (let i = 0; i < wordArray.length - 2; i++) {
            const phrase = `${wordArray[i]} ${wordArray[i + 1]} ${wordArray[i + 2]}`;
            if (phrase.length > 8) phrases.push(phrase);
        }

        // 4-word phrases (for things like "Chief Minister's Floriculture Mission")
        for (let i = 0; i < wordArray.length - 3; i++) {
            const phrase = `${wordArray[i]} ${wordArray[i + 1]} ${wordArray[i + 2]} ${wordArray[i + 3]}`;
            if (phrase.length > 12) phrases.push(phrase);
        }

        return { words, phrases };
    }

    private isStopWord(word: string): boolean {
        const stopWords = new Set([
            "the",
            "is",
            "at",
            "which",
            "on",
            "and",
            "or",
            "but",
            "in",
            "with",
            "to",
            "for",
            "of",
            "as",
            "by",
            "an",
            "are",
            "was",
            "been",
            "be",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "must",
            "can",
            "this",
            "that",
            "these",
            "those",
        ]);
        return stopWords.has(word.toLowerCase());
    }

    private stemWord(word: string): string {
        // Simple stemming - remove common suffixes
        word = word.toLowerCase();

        // Remove plurals
        if (word.endsWith("ies")) return word.slice(0, -3) + "y";
        if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss"))
            return word.slice(0, -1);

        // Remove -ing, -ed
        if (word.endsWith("ing") && word.length > 6) return word.slice(0, -3);
        if (word.endsWith("ed") && word.length > 5) return word.slice(0, -2);

        return word;
    }

    private calculateTF(terms: string[]): Map<string, number> {
        const tf = new Map<string, number>();
        const totalTerms = terms.length;

        for (const term of terms) {
            tf.set(term, (tf.get(term) || 0) + 1);
        }

        // Use log-normalized TF for better scoring
        for (const [term, count] of tf) {
            tf.set(term, 1 + Math.log(count));
        }

        return tf;
    }

    addDocuments(documents: DocumentChunk[]): void {
        this.documents = documents;
        this.vocabulary.clear();
        this.phraseIndex.clear();
        this.wordIndex.clear();
        this.termFrequency.clear();
        this.documentFrequency.clear();
        this.idf.clear();

        // Build vocabulary and calculate term frequencies
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const { words, phrases } = this.tokenize(doc.content);

            // Process words with stemming
            const stemmedWords = words.map((word) => this.stemWord(word));
            const allTerms = [...stemmedWords, ...phrases];

            const tf = this.calculateTF(allTerms);
            this.termFrequency.set(i.toString(), tf);

            // Build phrase index for exact matching
            phrases.forEach((phrase) => {
                if (!this.phraseIndex.has(phrase)) {
                    this.phraseIndex.set(phrase, new Set());
                }
                this.phraseIndex.get(phrase)!.add(i);
            });

            // Build word inverted index (stemmed)
            const uniqueStemmedWords = new Set(stemmedWords);
            uniqueStemmedWords.forEach((term) => {
                if (!this.wordIndex.has(term)) {
                    this.wordIndex.set(term, new Set());
                }
                this.wordIndex.get(term)!.add(i);
            });

            // Add to vocabulary and track document frequency
            const uniqueTerms = new Set(allTerms);
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

        const { words, phrases } = this.tokenize(query);
        const stemmedWords = words.map((word) => this.stemWord(word));
        const allQueryTerms = [...stemmedWords, ...phrases];

        const scores: Array<{
            document: DocumentChunk;
            score: number;
            docIndex: number;
        }> = [];

        // Candidate generation using inverted indices for scalability
        const candidateIndices = new Set<number>();
        for (const term of stemmedWords) {
            const posting = this.wordIndex.get(term);
            if (posting) posting.forEach((idx) => candidateIndices.add(idx));
        }
        for (const phrase of phrases) {
            const posting = this.phraseIndex.get(phrase);
            if (posting) posting.forEach((idx) => candidateIndices.add(idx));
        }

        // Fallback to a capped random sample if no candidates from indices
        if (candidateIndices.size === 0) {
            const cap = Math.min(1000, this.documents.length);
            for (let i = 0; i < cap; i++) candidateIndices.add(i);
        }

        // Optional cap on candidates to keep search fast on huge corpora
        const MAX_CANDIDATES = 5000;
        const candidates = Array.from(candidateIndices).slice(
            0,
            MAX_CANDIDATES
        );

        for (const i of candidates) {
            let score = 0;
            const tf = this.termFrequency.get(i.toString()) || new Map();

            // 1. TF-IDF scoring for individual terms
            for (const term of allQueryTerms) {
                const termTF = tf.get(term) || 0;
                const termIDF = this.idf.get(term) || 0;
                score += termTF * termIDF;
            }

            // 2. Phrase matching bonus (highest weight)
            const content = this.documents[i].content.toLowerCase();
            for (const phrase of phrases) {
                if (
                    this.phraseIndex.has(phrase) &&
                    this.phraseIndex.get(phrase)!.has(i)
                ) {
                    score += 5.0; // High bonus for exact phrase match
                }
                if (content.includes(phrase)) {
                    score += 3.0; // Medium bonus for substring match
                }
            }

            // 3. Exact word matching bonus
            for (const word of words) {
                if (content.includes(word)) {
                    score += 0.5; // Small bonus for exact word match
                }
            }

            // 4. Title/filename matching (extra bonus)
            const source = this.documents[i].metadata.source.toLowerCase();
            for (const word of words) {
                if (source.includes(word)) {
                    score += 1.0; // Bonus for filename match
                }
            }

            for (const phrase of phrases) {
                if (source.includes(phrase)) {
                    score += 2.0; // Higher bonus for phrase in filename
                }
            }

            if (score > 0) {
                scores.push({
                    document: this.documents[i],
                    score,
                    docIndex: i,
                });
            }
        }

        // Sort by score and return top results
        scores.sort((a, b) => b.score - a.score);

        // Debug logging
        if (scores.length > 0) {
            console.log(`🔍 Search results for "${query}":`);
            for (let i = 0; i < Math.min(3, scores.length); i++) {
                const result = scores[i];
                const filename =
                    result.document.metadata.source.split("/").pop() ||
                    "unknown";
                console.log(
                    `  ${i + 1}. ${filename} (score: ${result.score.toFixed(2)})`
                );
            }
        }

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
    private searchEngine: EnhancedSearchEngine;
    private documents: DocumentChunk[] = [];
    private textSplitter: SimpleTextSplitter;
    private documentsPath: string;
    private initialized = false;

    constructor() {
        // Enhanced search engine with phrase matching (ZERO OpenAI cost!)
        this.searchEngine = new EnhancedSearchEngine();

        this.textSplitter = new SimpleTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        // Load knowledge base from the new datasets directory
        this.documentsPath = join(process.cwd(), "datasets");
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log(
            "🔄 Initializing RAG system with ENHANCED LOCAL SEARCH (NO OpenAI cost)..."
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
            const visited = new Set<string>();
            await this.loadDocumentsFromDirectory(
                this.documentsPath,
                documents,
                visited
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
            for (const c of splitDocs) {
                chunks.push(c);
            }
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
        documents: Document[],
        visited: Set<string>
    ): Promise<void> {
        if (visited.has(dirPath)) return;
        visited.add(dirPath);

        let files: string[] = [];
        try {
            files = readdirSync(dirPath);
        } catch (e) {
            console.warn(`⚠️ Cannot read directory ${dirPath}:`, e);
            return;
        }

        for (const file of files) {
            const filePath = join(dirPath, file);
            let lst;
            try {
                lst = lstatSync(filePath);
            } catch (e) {
                console.warn(`⚠️ Cannot stat ${filePath}:`, e);
                continue;
            }

            // Skip symlinks to avoid cycles
            if (lst.isSymbolicLink()) continue;

            if (lst.isDirectory()) {
                await this.loadDocumentsFromDirectory(
                    filePath,
                    documents,
                    visited
                );
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

        console.log("🔄 Building enhanced search index (NO OpenAI cost)...");
        this.searchEngine.addDocuments(this.documents);
        console.log("✅ Enhanced search index built successfully");
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
            // Use enhanced local search (NO OPENAI COST!)
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
