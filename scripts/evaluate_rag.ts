import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { config as dotenvConfig } from "dotenv";
import { OpenAIService } from "../src/services/openai";

dotenvConfig();

interface TestItem {
    question: string;
    expected_answer: string;
    expected_keywords: string[];
    source: string;
}

interface EvalResult {
    question: string;
    source: string;
    found_docs: number;
    has_rag: boolean;
    answer: string;
    keyword_recall: number; // fraction of expected keywords present
}

function keywordRecall(expected: string[], output: string): number {
    if (expected.length === 0) return 1.0;
    const text = output.toLowerCase();
    let hit = 0;
    for (const k of expected) {
        if (text.includes(k.toLowerCase())) hit++;
    }
    return hit / expected.length;
}

async function main() {
    const ROOT = process.cwd();
    const INPUT = join(ROOT, "tests", "rag_evaluation", "testset.jsonl");
    const OUTDIR = join(ROOT, "tests", "rag_evaluation");
    const REPORT_JSON = join(OUTDIR, "report.json");
    const REPORT_MD = join(OUTDIR, "REPORT.md");

    mkdirSync(OUTDIR, { recursive: true });

    const lines = readFileSync(INPUT, "utf-8")
        .trim()
        .split(/\n/)
        .filter(Boolean);
    const items: TestItem[] = lines.map((l) => JSON.parse(l));
    const limit = Number(process.env.RAG_EVAL_LIMIT || "100");
    const evalItems = items.slice(0, Math.max(1, limit));

    const svc = new OpenAIService();
    await svc.initialize();

    const results: EvalResult[] = [];
    for (const item of evalItems) {
        const res = await svc.generateResponse(item.question);
        const recall = keywordRecall(item.expected_keywords, res.response);
        results.push({
            question: item.question,
            source: item.source,
            found_docs: res.ragContext.documentsFound,
            has_rag: res.ragContext.hasRAGContext,
            answer: res.response,
            keyword_recall: Number(recall.toFixed(3)),
        });
    }

    writeFileSync(REPORT_JSON, JSON.stringify(results, null, 2));

    // Markdown summary
    const avgRecall =
        results.reduce((s, r) => (s += r.keyword_recall), 0) /
        Math.max(results.length, 1);
    const md: string[] = [];
    md.push("# RAG Evaluation Report");
    md.push("");
    md.push(`Total questions evaluated: ${results.length}`);
    md.push(`Average keyword recall: ${avgRecall.toFixed(3)}`);
    md.push("");
    md.push("## Samples");
    for (let i = 0; i < Math.min(25, results.length); i++) {
        const r = results[i];
        md.push(`- Q: ${r.question}`);
        md.push(`  - Source: ${r.source}`);
        md.push(`  - Docs found: ${r.found_docs}, RAG used: ${r.has_rag}`);
        md.push(`  - Recall: ${r.keyword_recall}`);
    }
    writeFileSync(REPORT_MD, md.join("\n"));

    console.log(`Wrote ${REPORT_JSON} and ${REPORT_MD}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
