<script module lang="ts">
	import type { Snippet } from 'svelte';

	export type MorphPanel = { id: string; content: Snippet };
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { SvelteMap } from 'svelte/reactivity';
	import { watch } from 'runed';
	import styles from '../styles/morph-bar.module.css';

	type Props = {
		panels: MorphPanel[];
		active: string;
		vertical?: boolean;
		side?: 'left' | 'right';
		collapsed?: boolean;
		collapsedContent?: Snippet;
		onexpand?: () => void;
		shift?: number;
		onmeasure?: (width: number, height: number) => void;
		class?: string;
	};

	let {
		panels,
		active,
		vertical = false,
		side,
		collapsed = false,
		collapsedContent,
		onexpand,
		shift = 0,
		onmeasure,
		class: className
	}: Props = $props();

	const panelElements = new SvelteMap<string, HTMLDivElement>();
	let extent = $state<number | null>(null);
	let settled = $state(false);

	function measure(): void {
		const panel = panelElements.get(active);
		if (!panel) return;

		const next = vertical ? panel.scrollHeight : panel.scrollWidth;
		extent = next;
		onmeasure?.(vertical ? 66 : next, vertical ? next : 84);
	}

	function attachPanel(id: string): Attachment<HTMLDivElement> {
		return (node) => {
			panelElements.set(id, node);
			const observer = new ResizeObserver(() => {
				if (id === active) measure();
			});
			observer.observe(node);
			if (id === active) void tick().then(measure);

			return () => {
				observer.disconnect();
				panelElements.delete(id);
			};
		};
	}

	watch([() => active, () => vertical], () => void tick().then(measure));

	onMount(() => {
		const frame = requestAnimationFrame(() => (settled = true));
		return () => cancelAnimationFrame(frame);
	});
</script>

<div
	class={[styles.bar, vertical && styles.vertical, collapsed && styles.collapsed, className]}
	data-side={side}
	style:visibility={extent === null ? 'hidden' : undefined}
	style:width={!collapsed && !vertical && extent !== null ? `${extent}px` : undefined}
	style:height={!collapsed && vertical && extent !== null ? `${extent}px` : undefined}
	style:translate={collapsed ? (vertical ? `0 ${shift}px` : `${shift}px 0`) : undefined}
	style:transition={settled ? undefined : 'none'}
>
	<div class={styles.clip}>
		{#each panels as panel (panel.id)}
			<div
				class={styles.panel}
				data-active={panel.id === active && !collapsed ? '' : undefined}
				aria-hidden={panel.id === active && !collapsed ? undefined : 'true'}
				{@attach attachPanel(panel.id)}
			>
				{@render panel.content()}
			</div>
		{/each}
	</div>

	{#if collapsedContent}
		<div class={styles.collapsedContent} data-shown={collapsed ? '' : undefined}>
			{@render collapsedContent()}
		</div>
	{/if}

	{#if collapsed}
		<button
			type="button"
			class={styles.expandHit}
			onclick={onexpand}
			aria-label="Show drawing tools"
		></button>
	{/if}
</div>
