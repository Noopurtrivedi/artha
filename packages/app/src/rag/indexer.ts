/**
 * RAG Indexer — builds and queries a local vector index over user files.
 * Uses Ollama's embedding endpoint (nomic-embed-text by default).
 * Stores vectors in a simple JSON file index (Phase 1 — LanceDB in Phase 2).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getDb } from '../db/schema';

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.pdf', '.docx', '.csv', '.json', '.ts', '.js', '.py'];
const CHUNK_SIZE = 512;       // characters per chunk
const CHUNK_OVERLAP = 64;
const OLLAMA_EMBED_URL = 'http://localhost:11434/api/embeddings';
const EMBED_MODEL = 'nomic-embed-text';

interface Chunk {
  id: string;
  filePath: string;
  text: string;
  embedding: number[];
}

export class RAGIndexer {
  private indexDir: string;

  constructor(indexDir: string) {
    this.indexDir = indexDir;
    fs.mkdirSync(indexDir, { recursive: true });
  }

  /** Index all supported files under a directory path. */
  async buildIndex(indexId: string, dirPath: string): Promise<number> {
    const files = this.collectFiles(dirPath);
    const chunks: Chunk[] = [];

    for (const file of files) {
      try {
        const text = fs.readFileSync(file, 'utf-8');
        const fileChunks = this.chunkText(text, file);
        for (const chunk of fileChunks) {
          const embedding = await this.embed(chunk.text);
          chunks.push({ ...chunk, embedding });
        }
      } catch {
        // Skip unreadable files silently
      }
    }

    const indexPath = path.join(this.indexDir, `${indexId}.json`);
    fs.writeFileSync(indexPath, JSON.stringify(chunks));

    const db = getDb();
    db.prepare(`UPDATE rag_indexes SET doc_count=?, last_indexed=unixepoch() WHERE index_id=?`)
      .run(chunks.length, indexId);

    return chunks.length;
  }

  /** Retrieve top-k most relevant chunks for a query. */
  async query(indexId: string, query: string, topK = 5): Promise<string[]> {
    const indexPath = path.join(this.indexDir, `${indexId}.json`);
    if (!fs.existsSync(indexPath)) return [];

    const chunks: Chunk[] = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const queryEmbedding = await this.embed(query);

    const scored = chunks.map(chunk => ({
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.text);
  }

  private collectFiles(dir: string): string[] {
    const results: string[] = [];
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) walk(full);
        else if (entry.isFile() && SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
          results.push(full);
        }
      }
    };
    walk(dir);
    return results;
  }

  private chunkText(text: string, filePath: string): Omit<Chunk, 'embedding'>[] {
    const chunks: Omit<Chunk, 'embedding'>[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const slice = text.slice(i, i + CHUNK_SIZE);
      if (slice.trim().length < 20) continue;
      chunks.push({
        id: crypto.createHash('md5').update(`${filePath}:${i}`).digest('hex'),
        filePath,
        text: slice,
      });
    }
    return chunks;
  }

  private async embed(text: string): Promise<number[]> {
    try {
      const res = await fetch(OLLAMA_EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      });
      const json = await res.json() as { embedding: number[] };
      return json.embedding;
    } catch {
      // Return zero vector if Ollama not available
      return new Array(768).fill(0);
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
