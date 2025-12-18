<script lang="ts">
	import { marked } from "marked";
	import { messages, status } from "../chat";

	export let view;

	let input = "";

	function send() {
		// block if not idle
		if ($status.phase !== "idle") return;

		// ignore empty inputs
		if (!input.trim()) return;

		// update svelte store
		messages.update(m => [...m, {role: "user", content: input}]);
		// const toSend = input;

		view.llama();
		input = "";
	}

	// TODO: fix this at some point
	// // autoscroll whenever messages update
	// $: (messagesContainer && (
		// messagesContainer.scrollTop = messagesContainer.scrollHeight
	// ));


</script>

<div class="chat-container">
	<div class="messages"> <!--bind:this={messagesContainer}> -->
		{#each $messages as msg}
			<div class="bubble {msg.role}">
				{@html marked(msg.content)}
			</div>
		{/each}
	</div>

	<div class="status">
		{#if $status.phase === "idle"} Ready
		{:else if $status.phase === "retrieving"} Retrieving context…
		{:else if $status.phase === "thinking"} {$status.detail ?? "Thinking…"}
		{:else if $status.phase === "calling_model"} Calling model…
		{:else if $status.phase === "error"} ⚠ {$status.message}
		{/if}
	</div>
	<textarea
	 class="chat-input"
  bind:value={input}
  placeholder="Type a message..."
  on:keydown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
  e.preventDefault();
  send();
  }
  }}
  ></textarea>

	<div class="buttons">
		<button on:click={view.test}>Test</button>
		<button on:click={view.summarize}>Summarize</button>
		<button on:click={view.clear}>Clear Conversation</button>
		<button on:click={view.update}>Update from vault</button>
	</div>
</div>


<style>

</style>
