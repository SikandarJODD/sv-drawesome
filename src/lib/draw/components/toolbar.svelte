<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import { PENS } from '../engine/pens';
	import type { Pen, PenId, ToolId } from '../engine/types';
	import { resolveSwatches } from '../palette';
	import { createTooltipController } from '../state/tooltip-controller.svelte';
	import type {
		DrawControls,
		Placement,
		SettingsPlacement,
		Theme,
		ToolLook,
		TooltipOptions,
		ToolState
	} from '../types';
	import morphStyles from '../styles/morph-bar.module.css';
	import styles from '../styles/toolbar.module.css';
	import '../styles/tokens.css';
	import BarSlider from './bar-slider.svelte';
	import HexField, { pickFromScreen, supportsEyeDropper } from './hex-field.svelte';
	import Icons from './icons.svelte';
	import MorphBar, { type MorphPanel } from './morph-bar.svelte';
	import ToolIcon from './tool-icon.svelte';
	import ToolMenu from './tool-menu.svelte';
	import Tooltip from './tooltip.svelte';
	import TrashIcon from './trash-icon.svelte';

	type Mode = 'tools' | 'ink' | 'brush' | 'spectrum';
	type ToolMenuValues = {
		size: number;
		maxSize: number;
		opacity: number;
		color: string;
		showOpacity: boolean;
	};

	type Props = {
		tool: ToolState;
		inkFor: (id: PenId) => string;
		tooltips?: boolean | TooltipOptions;
		pens?: Pen[];
		eraser?: boolean;
		controls?: DrawControls;
		settings?: SettingsPlacement;
		theme?: Theme;
		look?: ToolLook;
		gauge?: boolean;
		shortcuts?: boolean;
		swatches?: string[];
		onselect: (id: ToolId) => void;
		onchange: (patch: Partial<ToolState>) => void;
		canUndo: boolean;
		canRedo: boolean;
		onundo: () => void;
		onredo: () => void;
		onclear: () => void;
		hasStrokes: boolean;
		placement?: Placement;
		collapsed?: boolean;
		oncollapse?: () => void;
		onexpand?: () => void;
		shift?: number;
		onmeasure?: (width: number, height: number) => void;
		icon?: Snippet;
	};

	let {
		tool,
		inkFor,
		tooltips = true,
		pens = PENS,
		eraser = true,
		controls,
		settings = 'bar',
		theme = 'light',
		look = 'classic',
		gauge = false,
		shortcuts = true,
		swatches,
		onselect,
		onchange,
		canUndo,
		canRedo,
		onundo,
		onredo,
		onclear,
		hasStrokes,
		placement = 'bottom',
		collapsed = false,
		oncollapse,
		onexpand,
		shift = 0,
		onmeasure,
		icon
	}: Props = $props();

	let mode = $state<Mode>('tools');
	let canPick = $state(false);
	let openTool = $state<HTMLElement | null>(null);
	let closingTool = $state(false);
	let frozenMenu = $state<ToolMenuValues | null>(null);
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	let isEraser = $derived(tool.active === 'eraser');
	let vertical = $derived(placement !== 'bottom');
	let size = $derived(isEraser ? tool.eraserSize : tool.size);
	let maxSize = $derived(isEraser ? 120 : 80);
	let liveMenu = $derived<ToolMenuValues>({
		size,
		maxSize,
		opacity: tool.opacity,
		color: isEraser ? '#c9c7c2' : tool.color,
		showOpacity: !isEraser
	});
	let menu = $derived(frozenMenu ?? liveMenu);
	let shownControls = $derived({
		color: controls?.color ?? true,
		size: controls?.size ?? true,
		opacity: controls?.opacity ?? true,
		custom: controls?.custom ?? true,
		undo: controls?.undo ?? true,
		clear: controls?.clear ?? true,
		minimize: controls?.minimize ?? true
	});
	let sizeLabel = $derived(
		shownControls.size && shownControls.opacity && !isEraser
			? 'Size & opacity'
			: shownControls.size
				? 'Size'
				: 'Opacity'
	);

	const tooltip = createTooltipController(
		() => tooltips,
		() => placement
	);

	function isLight(color: string): boolean {
		const match = /^#?([\da-f]{6})$/i.exec(color.trim());
		if (!match) return false;

		const value = Number.parseInt(match[1], 16);
		const luminance =
			0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255);
		return luminance / 255 > 0.62;
	}

	function clearCloseTimer(): void {
		if (closeTimer === null) return;
		clearTimeout(closeTimer);
		closeTimer = null;
	}

	function closeMenu(): void {
		clearCloseTimer();
		frozenMenu = liveMenu;
		closingTool = true;
		closeTimer = setTimeout(() => {
			openTool = null;
			closingTool = false;
			frozenMenu = null;
		}, 150);
	}

	function showMenu(anchor: HTMLElement): void {
		clearCloseTimer();
		frozenMenu = null;
		closingTool = false;
		openTool = anchor;
	}

	function selectPen(event: MouseEvent & { currentTarget: HTMLButtonElement }, pen: Pen): void {
		if (settings === 'tool' && tool.active === pen.id) {
			if (openTool && !closingTool) closeMenu();
			else showMenu(event.currentTarget);
			return;
		}

		if (openTool) closeMenu();
		onselect(pen.id);
	}

	function chooseColor(color: string): void {
		onchange({ color });
		if (isEraser) onselect('pen');
	}

	onMount(() => {
		canPick = supportsEyeDropper();
	});

	onDestroy(clearCloseTimer);

	const panels: MorphPanel[] = [
		{ id: 'tools', content: toolsPanel },
		{ id: 'ink', content: inkPanel },
		{ id: 'spectrum', content: spectrumPanel },
		{ id: 'brush', content: brushPanel }
	];
</script>

{#snippet backButton()}
	<button
		type="button"
		class={styles.round}
		onclick={() => (mode = 'tools')}
		aria-label="Back to tools"
		{...tooltip.bindControl('Back')}
	>
		<Icons name="back" />
	</button>
{/snippet}

{#snippet toolsPanel()}
	{#if shownControls.undo}
		<span class={styles.seated}>
			<button
				type="button"
				class={styles.round}
				disabled={!canUndo}
				onclick={onundo}
				aria-label="Undo"
				{...tooltip.bindControl('Undo', shortcuts ? '⌘Z' : undefined)}
			>
				<Icons name="undo" />
			</button>
		</span>
		<span class={styles.seated}>
			<button
				type="button"
				class={styles.round}
				disabled={!canRedo}
				onclick={onredo}
				aria-label="Redo"
				{...tooltip.bindControl('Redo', shortcuts ? '⇧⌘Z' : undefined)}
			>
				<Icons name="redo" />
			</button>
		</span>
	{/if}

	{#if shownControls.clear}
		<span class={styles.seated}>
			<button
				type="button"
				class={styles.round}
				data-tone="danger"
				disabled={!hasStrokes}
				onclick={onclear}
				aria-label="Clear"
				{...tooltip.bindControl('Clear all')}
			>
				<TrashIcon />
			</button>
		</span>
	{/if}

	{#if shownControls.undo || shownControls.clear}<span class={styles.divider}></span>{/if}

	{#each pens as pen (pen.id)}
		<button
			type="button"
			class={styles.tool}
			data-active={tool.active === pen.id ? '' : undefined}
			onclick={(event) => selectPen(event, pen)}
			aria-label={pen.name}
			aria-pressed={tool.active === pen.id}
			aria-expanded={settings === 'tool' && tool.active === pen.id ? openTool !== null : undefined}
			{...tooltip.bind(pen.name, shortcuts ? pen.key : undefined)}
		>
			<ToolIcon
				id={pen.id}
				color={inkFor(pen.id)}
				{look}
				badge={gauge && tool.active === pen.id ? size : undefined}
			/>
		</button>
	{/each}

	{#if eraser}
		<button
			type="button"
			class={styles.tool}
			data-active={isEraser ? '' : undefined}
			onclick={() => onselect('eraser')}
			aria-label="Eraser"
			aria-pressed={isEraser}
			{...tooltip.bind('Eraser', shortcuts ? 'E' : undefined)}
		>
			<ToolIcon id="eraser" color={tool.color} {look} />
		</button>
	{/if}

	{#if (shownControls.size && settings === 'bar') || shownControls.color}
		<span class={styles.divider}></span>
	{/if}

	{#if (shownControls.size || shownControls.opacity) && settings === 'bar'}
		<span class={styles.seated}>
			<button
				type="button"
				class={styles.round}
				onclick={() => (mode = 'brush')}
				aria-label={sizeLabel}
				{...tooltip.bindControl(sizeLabel)}
			>
				<span
					class={styles.brushDot}
					style:width={`${6 + (size / maxSize) * 16}px`}
					style:height={`${6 + (size / maxSize) * 16}px`}
					style:background={isEraser ? '#c9c7c2' : tool.color}
					style:opacity={isEraser ? 1 : tool.opacity}
				></span>
			</button>
		</span>
	{/if}

	{#if shownControls.color}
		<span class={styles.seated}>
			<button
				type="button"
				class={styles.round}
				onclick={() => (mode = 'ink')}
				aria-label={`Ink colour — ${tool.color}`}
				{...tooltip.bindControl('Colour')}
			>
				<span class={styles.wheel}>
					<span class={styles.wheelInk} style:background={tool.color}></span>
				</span>
			</button>
		</span>
	{/if}

	{#if shownControls.minimize}<span class={styles.divider}></span>{/if}

	{#if shownControls.minimize}
		<span class={styles.seated}>
			<button
				type="button"
				class={styles.round}
				onclick={oncollapse}
				aria-label="Hide tools"
				{...tooltip.bindControl('Hide tools')}
			>
				<Icons name="collapse" />
			</button>
		</span>
	{/if}
{/snippet}

{#snippet inkPanel()}
	<div
		class={[morphStyles.centered, styles.row, styles.inkRow]}
		data-open-end={!shownControls.custom ? '' : undefined}
	>
		{@render backButton()}
		<span class={styles.divider}></span>
		<div class={styles.swatches}>
			{#each resolveSwatches(swatches, vertical) as color (color)}
				<button
					type="button"
					class={styles.chip}
					data-active={tool.color.toLowerCase() === color.toLowerCase() ? '' : undefined}
					style:background={color}
					onclick={() => chooseColor(color)}
					aria-label={color}
					title={color}
				>
					<svg
						class={styles.tick}
						viewBox="0 0 16 16"
						fill="none"
						stroke={isLight(color) ? '#111' : '#fff'}
						stroke-width="2.4"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M3.6 8.4 6.7 11.5 12.4 5.2" />
					</svg>
				</button>
			{/each}
		</div>
		{#if shownControls.custom}
			<span class={styles.divider}></span>
			<button
				type="button"
				class={styles.custom}
				onclick={() => (mode = 'spectrum')}
				aria-label="Pick any colour"
				{...tooltip.bindControl('Any colour')}
			>
				<span></span>
			</button>
		{/if}
	</div>
{/snippet}

{#snippet spectrumPanel()}
	<div class={[morphStyles.centered, styles.row]}>
		<button
			type="button"
			class={styles.round}
			onclick={() => (mode = 'ink')}
			aria-label="Back to swatches"
			{...tooltip.bindControl('Back')}
		>
			<Icons name="back" />
		</button>
		<span class={styles.divider}></span>
		<span class={styles.preview} style:background={tool.color} aria-hidden="true"></span>
		{#if !vertical}
			<HexField value={tool.color} onchange={chooseColor} />
		{/if}
		{#if canPick}
			<button
				type="button"
				class={styles.round}
				aria-label="Pick a colour from the screen"
				{...tooltip.bindControl('Pick from screen')}
				onclick={async () => {
					const color = await pickFromScreen();
					if (color) chooseColor(color);
				}}
			>
				<Icons name="dropper" />
			</button>
		{/if}
	</div>
{/snippet}

{#snippet brushPanel()}
	<div class={[morphStyles.centered, styles.row, styles.tail]}>
		{@render backButton()}
		{#if shownControls.size}
			<span class={styles.divider}></span>
			<BarSlider
				{vertical}
				label="Size"
				value={size}
				min={1}
				max={maxSize}
				curve={2}
				display={String(Math.round(size))}
				color={isEraser ? '#c9c7c2' : tool.color}
				onchange={(next) => onchange(isEraser ? { eraserSize: next } : { size: next })}
			/>
		{/if}
		{#if shownControls.opacity && !isEraser}
			<span class={styles.divider}></span>
			<BarSlider
				{vertical}
				label="Opacity"
				value={tool.opacity}
				min={0.05}
				max={1}
				display={`${Math.round(tool.opacity * 100)}%`}
				color={tool.color}
				checker
				onchange={(opacity) => onchange({ opacity })}
			/>
		{/if}
	</div>
{/snippet}

<MorphBar
	{panels}
	active={mode}
	class={placement === 'bottom'
		? undefined
		: `${styles.vertical} ${placement === 'left' ? styles.left : styles.right}`}
	{vertical}
	side={placement === 'bottom' ? undefined : placement}
	{collapsed}
	collapsedContent={icon}
	{onexpand}
	{shift}
	{onmeasure}
/>

<Tooltip controller={tooltip} />

{#if settings === 'tool' && openTool}
	<ToolMenu
		anchor={openTool}
		size={menu.size}
		maxSize={menu.maxSize}
		opacity={menu.opacity}
		color={menu.color}
		showOpacity={menu.showOpacity}
		{theme}
		closing={closingTool}
		onsize={(next) => onchange(isEraser ? { eraserSize: next } : { size: next })}
		onopacity={(opacity) => onchange({ opacity })}
		onclose={closeMenu}
	/>
{/if}
