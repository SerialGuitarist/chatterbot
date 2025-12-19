
// import { messages } from "./state/chat";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

// import { tool } from "langchain";
import { tool } from "@langchain/core/tools";
import * as z from "zod";


function toLC(msg) {
	if (msg.role === "assistant") return new AIMessage(msg.content);
	if (msg.role === "system") return new SystemMessage(msg.content);
	return new HumanMessage(msg.content);
}

export type LlamaStatus =
	| { phase: "idle" }
	| { phase: "retrieving" }
	| { phase: "calling_model" }
	| { phase: "thinking"; detail?: string }
	| { phase: "done" }
	| { phase: "error"; message: string };

export class Llama {
	model: ChatOpenAI;
	rag: RAGStore;
	onStatus?: (status: LlamaStatus) => void;
	
	constructor(apiKey: string, rag: RAGStore = null, onStatus?: (s: LlamaStatus) => void) {
		// console.log(this.apiKey);
		this.model = new ChatOpenAI({
			// apparently obsidian hides your environmental variables from plugins
			// openAIApiKey: process.env.OPENAI_API_KEY,
			// reading it from settings in main and passing it here
			apiKey: apiKey,
			model: "gpt-4o-mini",
			temperature: 0.7
			// other params...
		})
		this.rag = rag;
		this.onStatus = onStatus;
		this.systemMessage =  {
			role: "system",
			content: "You are a helpful assistant attached to an Obsidian Vault, a note-taking knowledge base. Your primary role is to help users with questions about this vault."
		};
		this.status({ phase: "idle"});
	}

	// if someone cares about its progress, it will notify them through this
	private status(s: LlamaStatus) {
		// ?.(s) calls the function only if it exists with the argument s
		this.onStatus?.(s);
	}

	async ask(messages) {
		try {
			// my attempts to decouple this code as much as possible
			// has lead me down some dark dark paths such as this code block

			// 1. get retriever
			this.status({ phase: "retrieving" });
			const retriever = this.rag.getRetriever();

			// 2. get last user query
			const lastUserMessage = messages[messages.length - 1].content;

			// 3. use that to get the context documents
			this.status({ phase: "thinking", detail: "Constructing context" });
			const output = await retriever.invoke(lastUserMessage);
			const contexts = output.map((doc) => doc.pageContent );
			const context = {role: "system", content: "Context: " + contexts.join("\n---\n")};

			// 4. append that to the messages
			const augmentedMessages = [
				this.systemMessage,
				...messages,
				context
			].map(toLC);

			this.status({ phase: "calling_model"});
			const result = await this.model.invoke(augmentedMessages);
			this.status({ phase: "idle"});

			return {
				reply: result.content,
				context: context
			};
		} catch (error) {
			this.status({ phase: "error", message: String(error)});
			throw error;
		}
	}

	async test() {
		console.log("calling test");
		const aiMsg = await this.model.invoke()
		console.log(aiMsg)
	}

}


export class ManualLlama extends Llama {
	tooledModel: any;
	retrieveTool: any;

	constructor(
		apiKey: string,
		rag: RAGStore = null,
		onStatus?: (s: LlamaStatus) => void
	) {
		super(apiKey, rag, onStatus);
		this.status({ phase: "thinking", detail: "Setting up model"});


		this.systemMessage = {
			role: "system",
			content: "You are a helpful assistant attached to an Obsidian Vault, a note-taking knowledge base. Your primary role is to help users with questions about this vault. If a user asks a question about something you\'re unsure about, you MUST use the \`retrieve\` tool to query the vault for relevant context documents."
		};

		this.retrieveTool = tool(
			async ({ query } : { query: string }) => {
				this.status({ phase: "thinking", detail: "Retrieving: " + query  });
				console.log("Retrieving: " + query);
				const retriever = this.rag.getRetriever();
				const documents = await retriever.invoke(query);
				const collatedDocuments = documents.map(d => d.pageContent).join("\n---\n");

				// -- testing the effectiveness of having the llm restructure the output --
				// const messages = [{"role": "user", "content": "Summarize the following: " + collatedDocuments}].map(toLC);
				// const response = await this.model.invoke(messages)
				// return response.content;
				// -- as it turns out, doesn't add a lot while making it much slower

				return collatedDocuments;

			}, 
			{
				name: "retrieve",
				description: "Retrieve relevant documents from Obsidian vault",
				schema: z.object({
					query: z.string().describe("Search query for the vault")
				}),
			}
		);

		this.tooledModel = this.model.bindTools([this.retrieveTool]);
		this.status({ phase: "idle"});
	}


	override async ask(originalMessages) {
		try {
			this.status({ phase: "thinking", detail: "Agent reasoning" });
			let context = "";

			for (let i = 0; i < 5; i++) {
				let messages = [
					this.systemMessage,
					...originalMessages,
					{role: "system", content: "Context: " + context}
				].map(toLC);

				const response = await this.tooledModel.invoke(messages)

				if (response.tool_calls) {
					for (const toolCall of response.tool_calls) {
						// console.log(toolCall);
						let query = toolCall.args.query;
						context += "Output of \`retrieve\` tool with query \"" + query + "\": " + await this.retrieveTool.invoke({ query }) + "\n---\n";
						// console.log(context);
					}
					this.status({ phase: "thinking", detail: "Agent reasoning with retrieved context" });
					continue;
				}

				this.status({ phase: "idle" });
				return {
					reply: response.content,
					context: context
				};
			}

			let messages = [
				this.systemMessage,
				...originalMessages,
				{role: "system", content: "Context: " + context}
			].map(toLC);

			const response = await this.model.invoke(messages)
			this.status({ phase: "idle" });
			return {
				reply: response.content,
				context: context
			};


		} catch (err) {
			this.status({ phase: "error", message: String(err) });
			throw err;
		}
	}

	override async test() {
		// Step 1: Model generates tool calls
		// const messages = [{"role": "user", "content": "What is Governance of Iron's relation with Public Universal Friend"}].map(toLC);
		const messages = [{"role": "user", "content": "Wazzap"}].map(toLC);

		const response = await this.model.invoke(messages)

		// Step 2: Execute tools and collect results
		for (const toolCall of response.tool_calls) {
			console.log(toolCall);
		}

		console.log(response);
	}



}




