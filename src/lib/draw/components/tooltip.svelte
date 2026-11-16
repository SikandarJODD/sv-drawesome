<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { portal } from '../actions/portal';
	import type { TooltipController, TooltipFace } from '../state/tooltip-controller.svelte';
	import styles from '../styles/tooltip.module.css';

	let { controller }: { controller: TooltipController } = $props();

	const measureFace: Attachment<HTMLDivElement> = (node) => {
		const measure = () => (controller.width = node.scrollWidth);
		const observer = new ResizeObserver(measure);
		measure();
		observer.observe(node);
		return () => observer.disconnect();
	};
</script>

{#snippet face(content: TooltipFace)}
	<span class={styles.label}>{content.label}</span>
	{#if content.hint}<kbd class={styles.hint}>{content.hint}</kbd>{/if}
{/snippet}

{#if controller.enabled && controller.shown}
	<div
		class={styles.anchor}
		style:transform={`translate3d(${controller.shown.x}px, ${controller.shown.y}px, 0)`}
		{@attach portal}
	>
		<div
			class={styles.tip}
			data-at={controller.shown.at}
			data-closing={controller.closing || undefined}
			style={controller.style}
			style:width={controller.width === null ? undefined : `${controller.width}px`}
			role="tooltip"
		>
			{#if controller.leaving}
				{#key `out-${controller.swap}`}
					<div class={styles.face} data-leaving>
						{@render face(controller.leaving)}
					</div>
				{/key}
			{/if}
			{#key `in-${controller.swap}`}
				<div class={styles.face} {@attach measureFace}>
					{@render face(controller.shown)}
				</div>
			{/key}
		</div>
	</div>
{/if}
