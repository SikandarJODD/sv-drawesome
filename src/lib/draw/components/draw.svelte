<script lang="ts">
	import { tick, untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { watch } from '../internal/watch/watch.svelte';
	import { PENS, PEN_BY_ID } from '../engine/pens';
	import { toPng as serializePng, toSvg as serializeSvg } from '../engine/serialize';
	import type { Board, PenId, Stroke, ToolId } from '../engine/types';
	import { createDrawing } from '../state/drawing-controller.svelte';
	import styles from '../styles/draw.module.css';
	import '../styles/tokens.css';
	import type { DrawHandle, DrawProps, MotionOptions, Tool, ToolState } from '../types';
	import DrawSurface from './draw-surface.svelte';
	import ToolIcon from './tool-icon.svelte';
	import Toolbar from './toolbar.svelte';

	type Edge = 'left' | 'right' | 'top' | 'bottom';
	type Pin = {
		x: { side: Extract<Edge, 'left' | 'right'>; gap: number };
		y: { side: Extract<Edge, 'top' | 'bottom'>; gap: number };
	};

	let {
		board,
		background = '#ffffff',
		initialStrokes,
		onChange,
		chrome = true,
		motion,
		placement = 'bottom',
		inset,
		align = 'center',
		minimizeAlign,
		theme = 'light',
		drawWhenMinimized = false,
		startMinimized = false,
		shortcuts = true,
		swatches,
		tooltips = true,
		tools,
		eraser = true,
		controls,
		settings = 'bar',
		look = 'classic',
		gauge = false,
		draggable = false,
		ink: inkMode = 'auto',
		depth = 'regular',
		class: className,
		style
	}: DrawProps = $props();

	const drawing = createDrawing(untrack(() => initialStrokes));
	const initialInk = untrack(() => (theme === 'dark' ? '#f2f1ef' : '#111111'));

	let rootNode: HTMLDivElement;
	let barNode: HTMLDivElement;
	let collapsed = $state(untrack(() => startMinimized));
	let measured = $state.raw<Board>({ w: 1600, h: 1000 });
	let inks = $state.raw<Partial<Record<PenId, string>>>({});
	let ink = $state(initialInk);
	let tool = $state<ToolState>({
		active: 'pen',
		color: initialInk,
		size: PEN_BY_ID.pen.defaultSize,
		opacity: PEN_BY_ID.pen.defaultOpacity,
		eraserSize: 28
	});
	let pin = $state.raw<Pin | null>(null);
	let held = $state(false);
	let fold = $state(0);
	let live = $state(untrack(() => chrome));
	let leaving = $state(false);

	let chosen = false;
	let tuned: Partial<Record<PenId, { size: number; opacity: number }>> = {};
	let grab = { dx: 0, dy: 0 };

	let startingInk = $derived(theme === 'dark' ? '#f2f1ef' : '#111111');
	let paint = $derived(
		background === 'transparent' || background === 'checker' ? null : background
	);
	let surfaceBoard = $derived(board ?? measured);
	let pens = $derived(tools ? tools.map((id) => PEN_BY_ID[id]) : PENS);
	let surfaceTool = $derived.by<Tool>(() =>
		tool.active === 'eraser'
			? { kind: 'eraser', size: tool.eraserSize }
			: {
					kind: 'pen',
					pen: tool.active,
					color: tool.color,
					size: tool.size,
					opacity: tool.opacity
				}
	);
	let move = $derived<MotionOptions>(
		typeof motion === 'string' ? { in: motion, out: motion } : (motion ?? {})
	);
	let enterWith = $derived(move.in ?? 'rise');
	let exitWith = $derived(move.out ?? move.in ?? 'rise');
	let foldEnd = $derived(minimizeAlign ?? (align === 'start' ? 'start' : 'end'));
	let foldOrigin = $derived(
		placement === 'bottom' ? 'center' : foldEnd === 'start' ? 'center top' : 'center bottom'
	);
	let resolvedInset = $derived(typeof inset === 'number' ? `${inset}px` : inset);

	const root: Attachment<HTMLDivElement> = (node) => {
		rootNode = node;
		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			if (width > 0 && height > 0) {
				measured = { w: Math.round(width), h: Math.round(height) };
			}
		});
		observer.observe(node);
		return () => observer.disconnect();
	};

	const bar: Attachment<HTMLDivElement> = (node) => {
		barNode = node;
		const settle = () => {
			if (!pin || held) return;
			const rootBounds = rootNode.getBoundingClientRect();
			const barBounds = node.getBoundingClientRect();
			pinTo(barBounds.left - rootBounds.left, barBounds.top - rootBounds.top);
		};
		const observer = new ResizeObserver(settle);
		observer.observe(node);
		window.addEventListener('resize', settle);
		requestAnimationFrame(measureFold);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', settle);
		};
	};

	function inkFor(id: PenId): string {
		if (inkMode === 'shared') return ink;
		return inks[id] ?? (inkMode === 'auto' ? PEN_BY_ID[id].defaultColor : undefined) ?? ink;
	}

	function select(id: ToolId): void {
		if (id === 'eraser') {
			tool.active = 'eraser';
			return;
		}

		const preset = PEN_BY_ID[id];
		const last = tuned[id];
		tool.active = id;
		tool.size = last?.size ?? preset.defaultSize;
		tool.opacity = last?.opacity ?? preset.defaultOpacity;
		tool.color = inkFor(id);
	}

	function patchTool(patch: Partial<ToolState>): void {
		if (patch.color && tool.active !== 'eraser') {
			chosen = true;
			const ownsInk =
				inkMode === 'per-tool' ||
				(inkMode === 'auto' && Boolean(PEN_BY_ID[tool.active].defaultColor));

			if (ownsInk) inks = { ...inks, [tool.active]: patch.color };
			else ink = patch.color;
		}

		if ((patch.size !== undefined || patch.opacity !== undefined) && tool.active !== 'eraser') {
			tuned[tool.active] = {
				size: patch.size ?? tool.size,
				opacity: patch.opacity ?? tool.opacity
			};
		}

		Object.assign(tool, patch);
	}

	function nudgeSize(delta: number): void {
		if (tool.active === 'eraser') {
			tool.eraserSize = Math.max(1, Math.min(120, tool.eraserSize + delta));
			return;
		}

		tool.size = Math.max(1, Math.min(80, tool.size + delta));
		tuned[tool.active] = { size: tool.size, opacity: tool.opacity };
	}

	function pinTo(left: number, top: number): void {
		const bounds = rootNode.getBoundingClientRect();
		const width = barNode.offsetWidth;
		const height = barNode.offsetHeight;
		const padding = 8;
		const x = Math.min(Math.max(left, padding), Math.max(padding, bounds.width - padding - width));
		const y = Math.min(Math.max(top, padding), Math.max(padding, bounds.height - padding - height));
		const right = bounds.width - x - width;
		const bottom = bounds.height - y - height;

		pin = {
			x: x <= right ? { side: 'left', gap: x } : { side: 'right', gap: right },
			y: y <= bottom ? { side: 'top', gap: y } : { side: 'bottom', gap: bottom }
		};
	}

	function handleBarDown(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
		if (!draggable || collapsed) return;
		if ((event.target as HTMLElement).closest("button,input,[role='slider']")) return;

		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		const barBounds = event.currentTarget.getBoundingClientRect();
		const rootBounds = rootNode.getBoundingClientRect();
		grab = { dx: event.clientX - barBounds.left, dy: event.clientY - barBounds.top };
		pinTo(barBounds.left - rootBounds.left, barBounds.top - rootBounds.top);
		held = true;
	}

	function handleBarMove(event: PointerEvent): void {
		if (!held) return;
		const bounds = rootNode.getBoundingClientRect();
		pinTo(event.clientX - bounds.left - grab.dx, event.clientY - bounds.top - grab.dy);
	}

	function handleBarUp(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
		if (!held) return;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		held = false;
	}

	function measureFold(): void {
		if (pin) {
			fold = 0;
			return;
		}
		if (!rootNode || !barNode) return;

		const horizontal = placement === 'bottom';
		const span = horizontal ? rootNode.clientWidth : rootNode.clientHeight;
		const position = getComputedStyle(barNode);
		const gap = Number.parseFloat(position[placement]);
		const half = horizontal ? 42 : 33;
		const center =
			align === 'start'
				? Number.parseFloat(position[horizontal ? 'left' : 'top']) + half
				: align === 'end'
					? span - Number.parseFloat(position[horizontal ? 'right' : 'bottom']) - half
					: span / 2;
		const targetHalf = horizontal ? 28 : 33;
		const target = foldEnd === 'start' ? gap + targetHalf : span - gap - targetHalf;
		fold = target - center;
	}

	function handleShortcut(event: KeyboardEvent): void {
		if (!shortcuts) return;
		if (!rootNode.contains(document.activeElement) && document.activeElement !== document.body)
			return;

		const meta = event.metaKey || event.ctrlKey;
		const key = event.key.toLowerCase();
		if (meta && key === 'z') {
			event.preventDefault();
			if (event.shiftKey) drawing.redo();
			else drawing.undo();
			return;
		}
		if (meta && key === 'y') {
			event.preventDefault();
			drawing.redo();
			return;
		}
		if (meta) return;
		if (key === 'e' && eraser) {
			select('eraser');
			return;
		}
		if (key === '[' || key === ']') {
			nudgeSize(key === '[' ? -1 : 1);
			return;
		}
		const pen = pens.find((candidate) => candidate.key === key);
		if (pen) select(pen.id);
	}

	function handleAnimationEnd(event: AnimationEvent): void {
		if (event.target !== event.currentTarget || !leaving) return;
		live = false;
		leaving = false;
	}

	export function toSvg(): string {
		return serializeSvg(drawing.strokes, surfaceBoard.w, surfaceBoard.h, paint);
	}

	export function toPng(scale = 2): Promise<Blob> {
		return serializePng(drawing.strokes, surfaceBoard.w, surfaceBoard.h, paint, scale);
	}

	export async function download(name = 'drawing', format: 'svg' | 'png' = 'svg', scale = 2) {
		const blob =
			format === 'png' ? await toPng(scale) : new Blob([toSvg()], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `${name}.${format}`;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	export function getStrokes(): Stroke[] {
		return drawing.strokes;
	}

	export function setStrokes(strokes: Stroke[]): void {
		drawing.commit(strokes);
	}

	export const undo: DrawHandle['undo'] = drawing.undo;
	export const redo: DrawHandle['redo'] = drawing.redo;
	export const clear: DrawHandle['clear'] = drawing.clear;

	export function getSize(): Board {
		return surfaceBoard;
	}

	watch(
		() => drawing.strokes,
		(strokes) => onChange?.(strokes)
	);

	watch(
		() => startingInk,
		(color) => {
			if (chosen) return;
			ink = color;
			tool.color = color;
		}
	);

	watch([() => chrome, () => exitWith], () => {
		if (chrome) {
			leaving = false;
			live = true;
		} else if (exitWith === 'none') {
			live = false;
		} else {
			leaving = true;
		}
	});

	watch(
		[
			() => align,
			() => foldEnd,
			() => inset,
			() => placement,
			() => pin,
			() => live,
			() => measured.w,
			() => measured.h
		],
		() => void tick().then(measureFold)
	);

	watch(
		() => theme,
		(currentTheme) => {
			if (currentTheme !== 'auto' || chosen) return;
			if (!window.matchMedia('(prefers-color-scheme: dark)').matches) return;
			ink = '#f2f1ef';
			tool.color = '#f2f1ef';
		}
	);
</script>

<svelte:window onkeydown={handleShortcut} />

{#snippet collapsedIcon()}
	<ToolIcon id={tool.active} color={tool.color} {look} size={42} />
{/snippet}

<div
	{@attach root}
	class={['sd', styles.root, className]}
	data-theme={theme}
	data-placement={placement}
	data-depth={depth}
	data-background={background === 'transparent' ? 'none' : undefined}
	{style}
	tabindex="-1"
>
	<DrawSurface
		{drawing}
		board={surfaceBoard}
		{background}
		tool={surfaceTool}
		disabled={chrome && collapsed && !drawWhenMinimized}
		class={styles.surface}
	/>

	{#if live}
		<div
			{@attach bar}
			role="group"
			aria-label="Drawing tools"
			class={styles.toolbar}
			data-placement={placement}
			data-align={align}
			data-motion-in={enterWith}
			data-motion-out={exitWith}
			data-leaving={leaving ? '' : undefined}
			data-draggable={draggable && !collapsed ? '' : undefined}
			data-held={held ? '' : undefined}
			style:--sd-inset={resolvedInset}
			style:--sd-motion={move.duration ? `${move.duration}ms` : undefined}
			style:--fold-origin={pin ? `${pin.x.side} ${pin.y.side}` : foldOrigin}
			style:left={pin ? (pin.x.side === 'left' ? `${pin.x.gap}px` : 'auto') : undefined}
			style:right={pin ? (pin.x.side === 'right' ? `${pin.x.gap}px` : 'auto') : undefined}
			style:top={pin ? (pin.y.side === 'top' ? `${pin.y.gap}px` : 'auto') : undefined}
			style:bottom={pin ? (pin.y.side === 'bottom' ? `${pin.y.gap}px` : 'auto') : undefined}
			style:translate={pin ? 'none' : undefined}
			style:max-width={pin ? 'none' : undefined}
			style:max-height={pin ? 'none' : undefined}
			onanimationend={handleAnimationEnd}
			onpointerdown={handleBarDown}
			onpointermove={handleBarMove}
			onpointerup={handleBarUp}
			onpointercancel={handleBarUp}
		>
			<Toolbar
				{placement}
				{collapsed}
				oncollapse={() => (collapsed = true)}
				onexpand={() => (collapsed = false)}
				shift={fold}
				icon={collapsedIcon}
				{tool}
				{inkFor}
				{tooltips}
				{pens}
				{eraser}
				{controls}
				{settings}
				{look}
				{gauge}
				{shortcuts}
				{swatches}
				{theme}
				onselect={select}
				onchange={patchTool}
				canUndo={drawing.canUndo}
				canRedo={drawing.canRedo}
				onundo={drawing.undo}
				onredo={drawing.redo}
				onclear={drawing.clear}
				hasStrokes={drawing.strokes.length > 0}
			/>
		</div>
	{/if}
</div>
