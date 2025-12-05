import { Plugin } from "obsidian";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
// import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import xxhash64 from "xxhash-wasm";

interface PersistedChunk {
	id: string;				// provided by document spliiter
	file: string;          	// original markdown path
	hash: string;			// checksum of the chunk
	embedding: number[];    // embedding vector
	content: string;		// yahoo
	position: number;      	// chunk index inside the file
}


interface PersistedRAGData {
	chunks: PersistedChunk[];
}

// might move ower to something called a noncryptographic hash like xxhash
// if this turns out to be too slow
async function sha256(str: string) {
	const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
	return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// let xx: ((input: string, seed?: number) => string) | null = null;
let xx: any = null;

async function getXX() {
	if (!xx) {
		xx = await xxhash64();
	}
	return xx;
}

async function xxhash(str: string): Promise<string> {
	const { h64 } = await getXX();
	return h64(str); // returns hex string
}


export class RAGStore {
	plugin: Plugin;
	vectorStore: MemoryVectorStore | null = null;
	embeddings: OpenAIEmbeddings;
	chunks: PersistedChunk[] = [];
	hashFunction: (input: string) => Promise<string>;

	constructor(plugin: Plugin, hashFunction = xxhash) {
		this.plugin = plugin;
		this.embeddings = new OpenAIEmbeddings({
			model: "text-embedding-3-large",
			apiKey: plugin.settings.apiKey
		});
		this.hashFunction = hashFunction;
	}

	// read persistence from disk
	async load() {
		const data = await this.plugin.loadData();
		// data?. ony chains if data is not null otherwise is null
		// ?? [] returns [] if null
		const stored = (data?.chunks ?? []) as PersistedChunk[];

		this.chunks = stored;
		console.log("RAG: loaded", this.chunks.length, "chunks");

		this.vectorStore = new MemoryVectorStore(this.embeddings);

		if (this.chunks.length === 0) return;

		await this.vectorStore.addVectors(
			this.chunks.map(c => c.embedding),
			this.chunks.map(
				c =>
					new Document({
					pageContent: c.content,
					metadata: {
						id: c.id,
						file: c.file,
						hash: c.hash,
						position: c.position,
					},
				})
			)
		);
	}

	// save vector store as json into data.json
	async save() {
		const data = await this.plugin.loadData() ?? {};
		data.chunks = this.chunks;   // update just the RAG section
		await this.plugin.saveData(data);
		console.log("RAG: saved", this.chunks.length, "chunks");
	}

	// update index by embedding only changed chunks
	async updateFromVault() {
		const vault = this.plugin.app.vault;

		// build a lookup map for chunk reuse
		// const existingByHash = new Map();
		// for (const c of this.chunks) {
			// existingByHash.set(c.hash, c);
		// }
		// fancy one liner version
		const existingByHash = new Map(this.chunks.map(c => [c.hash, c]));

		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: 1000,
			chunkOverlap: 200,
		});

		const newChunks: PersistedChunk[] = [];

		// we rechunk every file
		// TODO: change this to rechunking only the files who has
		// last modification dates later than whenever we did all
		// the chunking? but then that doesnt take care of deletions
		for (const file of vault.getMarkdownFiles()) {
			const text = await vault.cachedRead(file);

			const splits = await splitter.splitText(text);

			// chunk indexing doesnt have anything to d owith
			// chunk sizing so we index them by 0s 1s and 2s
			let position = 0;
			// then we see if the checksums of each of the chunks
			// exist in our old chunks
			for (const chunkText of splits) {
				const hash = await this.hashFunction(chunkText);

				// if we already have a cjunk with this hash, reuse it
				const existing = existingByHash.get(hash);
				if (existing) {
					// gotta account for files that were moved around
					// which changes hteir metadata but doesnt change
					// the hash
					const reused = { ...existing, file: file.path, position };
					newChunks.push(reused);
				} else {
					// we dont care if this was modified or newly created
					// embed new chunk
					const embedding = await this.embeddings.embedQuery(chunkText);

					newChunks.push({
						id: crypto.randomUUID(),
						file: file.path,
						hash,
						embedding,
						content: chunkText,
						position,
					});
				}

				position++;
			}
		}

		// replace old chunks
		// we are leaving out the chunks present in old chunk
		// that didnt have a matching checksum becuase they were edited
		this.chunks = newChunks;

		// rebuild vector store
		this.vectorStore = new MemoryVectorStore(this.embeddings);
		await this.vectorStore.addVectors(
			this.chunks.map(c => c.embedding),
			this.chunks.map(
				c =>
					new Document({
					pageContent: c.content,
					metadata: {
						id: c.id,
						file: c.file,
						hash: c.hash,
						position: c.position,
					},
				})
			)
		);

		await this.save();
	}

	// turn into a retriever
	getRetriever(k = 5) {
		if (!this.vectorStore)
			throw new Error("RAG not loaded — call rag.load() first");
		return this.vectorStore.asRetriever(k);
	}
}

