<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { watch } from '../internal/watch/watch.svelte';
	import { portal } from '../actions/portal';
	import type { Theme } from '../types';
	import styles from '../styles/tool-menu.module.css';
	import BarSlider from './bar-slider.svelte';

	type Props = {
		anchor: HTMLElement | null;
		size: number;
		maxSize: number;
		opacity: number;
		color: string;
		showOpacity?: boolean;
		theme?: Theme;
		closing?: boolean;
		onsize: (size: number) => void;
		onopacity: (opacity: number) => void;
		onclose: () => void;
	};

	let {
		anchor,
		size,
		maxSize,
		opacity,
		color,
		showOpacity = true,
		theme = 'light',
		closing = false,
		onsize,
		onopacity,
		onclose
	}: Props = $props();

	let menu: HTMLDivElement;
	let position = $state<{ x: number; y: number; beak: number } | null>(null);

	function place(): void {
		if (!anchor || !menu) return;

		const anchorBounds = anchor.getBoundingClientRect();
		const width = menu.offsetWidth;
		const artwork = anchor.querySelector('svg');
		const artworkBounds = artwork?.getBoundingClientRect() ?? anchorBounds;
		const half = width / 2;
		const center = artworkBounds.left + artworkBounds.width / 2;
		const x = Math.min(Math.max(center, half + 8), window.innerWidth - half - 8);
		const beak = Math.min(Math.max(center - (x - half), 22), width - 22);

		position = { x, y: anchorBounds.top - 12, beak };
	}

	const attachMenu: Attachment<HTMLDivElement> = (node) => {
		menu = node;
		const observer = new ResizeObserver(place);
		observer.observe(node);
		void tick().then(place);
		return () => observer.disconnect();
	};

	watch(
		() => anchor,
		() => void tick().then(place)
	);

	onMount(() => {
		const handlePointerDown = (event: PointerEvent) => {
			const path = event.composedPath();
			if (path.includes(menu) || (anchor && path.includes(anchor))) return;
			onclose();
		};
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onclose();
		};

		window.addEventListener('resize', place);
		window.addEventListener('scroll', place, true);
		document.addEventListener('pointerdown', handlePointerDown, true);
		document.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('resize', place);
			window.removeEventListener('scroll', place, true);
			document.removeEventListener('pointerdown', handlePointerDown, true);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if anchor}
	<div
		class={`sd ${styles.menu}`}
		data-theme={theme}
		data-closing={closing || undefined}
		style:left={position ? `${position.x}px` : undefined}
		style:top={position ? `${position.y}px` : undefined}
		style:--beak-x={position ? `${position.beak}px` : undefined}
		style:opacity={position ? undefined : 0}
		role="dialog"
		aria-label="Tool settings"
		{@attach portal}
		{@attach attachMenu}
	>
		<div class={styles.rows}>
			<BarSlider
				label="Size"
				value={size}
				min={1}
				max={maxSize}
				curve={2}
				display={String(Math.round(size))}
				{color}
				onchange={onsize}
			/>
			{#if showOpacity}
				<BarSlider
					label="Opacity"
					value={opacity}
					min={0.05}
					max={1}
					display={`${Math.round(opacity * 100)}%`}
					{color}
					checker
					onchange={onopacity}
				/>
			{/if}
		</div>
		<span class={styles.beak} aria-hidden="true"></span>
	</div>
{/if}
