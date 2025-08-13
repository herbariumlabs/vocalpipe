import {
    readdirSync,
    readFileSync,
    mkdirSync,
    writeFileSync,
    statSync,
} from "fs";
import { join, extname, basename } from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

interface TestItem {
    question: string;
    expected_answer: string;
    expected_keywords: string[];
    source: string;
}

const ROOT = process.cwd();
const DATASETS_DIR = join(ROOT, "datasets");
const OUTPUT_DIR = join(ROOT, "tests", "rag_evaluation");
const JSONL_PATH = join(OUTPUT_DIR, "testset.jsonl");
const MD_PATH = join(OUTPUT_DIR, "RAG_TESTSET.md");

function isSupported(file: string): boolean {
    const ext = extname(file).toLowerCase();
    return [".md", ".txt"].includes(ext);
}

function collectFiles(dir: string, acc: string[]): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            collectFiles(full, acc);
        } else if (isSupported(entry)) {
            acc.push(full);
        }
    }
}

function extractTitleAndSnippet(
    content: string,
    fallbackTitle: string
): { title: string; snippet: string } {
    const lines = content.split(/\r?\n/);
    let title = fallbackTitle;
    for (const line of lines) {
        const m = line.match(/^\s*#+\s+(.*)$/);
        if (m) {
            title = m[1].trim();
            break;
        }
    }
    // Find first non-empty paragraph
    let snippet = "";
    for (let i = 0; i < lines.length; i++) {
        const para: string[] = [];
        while (i < lines.length && lines[i].trim() !== "") {
            para.push(lines[i]);
            i++;
        }
        const candidate = para.join(" ").trim();
        if (candidate.length > 120) {
            snippet = candidate;
            break;
        }
    }
    if (!snippet) {
        snippet = content.replace(/\s+/g, " ").trim().slice(0, 800);
    }
    return { title, snippet };
}

function topKeywords(text: string, max = 10): string[] {
    const stop = new Set([
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
        "from",
        "into",
        "about",
        "over",
        "under",
        "between",
        "within",
        "without",
        "it",
        "its",
        "a",
        "an",
        "we",
        "you",
        "they",
        "their",
        "our",
        "his",
        "her",
        "him",
        "she",
        "he",
    ]);
    const freq = new Map<string, number>();
    text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !stop.has(w))
        .forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
    return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([w]) => w);
}

function buildQuestion(title: string): string {
    const lowered = title.toLowerCase();
    if (/(guideline|guidelines)/i.test(title))
        return `What are the key points in ${title}?`;
    if (
        /(policy|scheme|mission|yojana|act|order|rules|regulation)/i.test(
            lowered
        )
    )
        return `Give a brief overview of ${title}.`;
    return `Summarize ${title}.`;
}

function main() {
    const files: string[] = [];
    collectFiles(DATASETS_DIR, files);

    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(JSONL_PATH, "");

    const mdLines: string[] = [
        "# RAG Testset",
        "",
        `Total files scanned: ${files.length}`,
        "",
    ];

    let created = 0;
    for (const file of files) {
        try {
            const raw = readFileSync(file, "utf-8");
            if (!raw.trim()) continue;
            const { title, snippet } = extractTitleAndSnippet(
                raw,
                basename(file, extname(file))
            );
            const q = buildQuestion(title);
            const keywords = topKeywords(snippet, 8);
            const item: TestItem = {
                question: q,
                expected_answer: snippet.slice(0, 1200),
                expected_keywords: keywords,
                source: file,
            };
            writeFileSync(JSONL_PATH, JSON.stringify(item) + "\n", {
                flag: "a",
            });
            mdLines.push(`- ${q} (source: ${file})`);
            created++;
        } catch {}
    }

    writeFileSync(MD_PATH, mdLines.join("\n"));
    console.log(`Generated ${created} test items at ${JSONL_PATH}`);
}

main();
