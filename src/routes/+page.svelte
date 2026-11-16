<script lang="ts">
	import { Draw } from '#lib';
</script>

<svelte:head>
	<title>Svelte Drawesome</title>
	<meta
		name="description"
		content="A Svelte drawing surface with pressure-aware pens, erasing, history, and exports."
	/>
</svelte:head>

<main>
	<div class="canvas">
		<Draw
			background="transparent"
			placement="bottom"
			settings="bar"
			theme="light"
			draggable
			gauge
		/>
	</div>
</main>

<style>
	main {
		box-sizing: border-box;
		width: 100%;
		min-height: 100svh;
		padding: clamp(0.75rem, 2vw, 1.5rem);
		background: #dedbd3;
	}

	.canvas {
		height: calc(100svh - clamp(1.5rem, 4vw, 3rem));
		min-height: 28rem;
		overflow: hidden;
		background-color: #f7f5f0;
		background-image:
			linear-gradient(to right, rgb(86 103 112 / 8%) 1px, transparent 1px),
			linear-gradient(to bottom, rgb(86 103 112 / 8%) 1px, transparent 1px),
			linear-gradient(to right, rgb(86 103 112 / 4%) 1px, transparent 1px),
			linear-gradient(to bottom, rgb(86 103 112 / 4%) 1px, transparent 1px);
		background-position: center;
		background-size:
			280px 280px,
			280px 280px,
			56px 56px,
			56px 56px;
		border: 1px solid rgb(35 31 25 / 12%);
		border-radius: 1rem;
		box-shadow: 0 16px 40px rgb(35 31 25 / 10%);
	}
</style>
