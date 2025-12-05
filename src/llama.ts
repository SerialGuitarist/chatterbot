
// import { messages } from "./state/chat";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";


function toLC(msg) {
	if (msg.role === "assistant") return new AIMessage(msg.content);
	if (msg.role === "system") return new SystemMessage(msg.content);
	return new HumanMessage(msg.content);
}

export default class Llama {
	model: ChatOpenAI;
	apiKey: string;
	
	constructor(apiKey: string) {
		this.apiKey = apiKey;
		// console.log(this.apiKey);
		this.model = new ChatOpenAI({
			// apparently obsidian hides your environmental variables from plugins
			// openAIApiKey: process.env.OPENAI_API_KEY,
			// reading it from settings in main and passing it here
			apiKey: this.apiKey,
			model: "gpt-4o-mini",
			temperature: 0.7
			// other params...
		})
	}

	async ask(messages) {
		const formatted = messages.map(toLC);
		const result = await this.model.invoke(formatted);
		return result;
	}

	async test() {
		console.log("calling test");
		const aiMsg = await this.model.invoke()
		console.log(aiMsg)
	}

}

