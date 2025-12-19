Chatbot for Obsidian. Features a chat UI built in Svelte and the LLM logic implemented primarily in Langchain. Currently uses OpenAI API, thus needs your API key. Composed of:
1. RAG store:
    - Upon first activation goes over your entire vault and chunks them into 1000 character chunks and embeds them with the OpenAI embedding model
    - Saves the embeddings in a memory vector store and as well as local persistent storage to be loaded instead of re-embedding everything
    - First activation is likely going to be fairly slow on a large vault (and involve many API calls)
2. Chatbot with agentic retrieval:
    - Uses Langchain's tool use to decide when and what to query from the RAG store
    - Looks at the contexts collected and generates the output
