<script lang="ts">
	import { messages } from "../chat";

	export let view;

	let input = "";
//	let messagesContainer: HTMLDivElement;

	// function send() {
		// // ignore empty inputs
		// if (!input.trim()) return;
	// 
		// // update svelte store
		// messages.update(m => [...m, {role: "user", content: input}]);
// 
		// const toSend = input;
// 
		// // fake reply
		// setTimeout(() => {
			// messages.update(m => [
				// ...m,
				// {role: "assistant", content:"Hello, you said: " + toSend}
			// ]);
		// }, 300);
// 
		// input = "";
	// }

	function send() {
		// ignore empty inputs
		if (!input.trim()) return;
	
		// update svelte store
		messages.update(m => [...m, {role: "user", content: input}]);
		// const toSend = input;
		
		view.llama();
		input = "";
	}

	// // autoscroll whenever messages update
	// $: (messagesContainer && (
		// messagesContainer.scrollTop = messagesContainer.scrollHeight
	// ));


</script>

<div class="chat-container">
	<div class="messages"> <!--bind:this={messagesContainer}> -->
    {#each $messages as msg}
      <div class="bubble {msg.role}">
        {msg.content}
      </div>
    {/each}
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

  <button on:click={view.test}>Test</button>
  <button on:click={view.clear}>Clear</button>
  <button on:click={view.llama}>Llama</button>
</div>


<style>

</style>
