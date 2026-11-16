<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { dotRadius, eraseLayers, nextId, polylinePath, strokePath } from '../engine/geometry';
	import { PEN_BY_ID } from '../engine/pens';
	import type { Point } from '../engine/types';
	import type { DrawSurfaceProps, Tool } from '../types';

	type Position = { x: number; y: number };
	type StraightRun = {
		anchor: Point;
		heading: number | null;
		settled: Point[];
	};
	type EraserPath = { d: string; width: number };
	type InkPath = {
		id: number;
		d: string;
		color: string;
		opacity: number;
		blend: boolean;
		dot: { x: number; y: number; r: number } | null;
	};

	let {
		drawing,
		board,
		background = '#ffffff',
		tool,
		showBrushCursor = true,
		disabled = false,
		class: className,
		style
	}: DrawSurfaceProps = $props();

	const componentId = $props.id();
	const uid = componentId.replaceAll(':', '');

	let surfaceNode: SVGSVGElement;
	let current = $state.raw<Point[]>([]);
	let hover = $state.raw<Position | null>(null);
	let lastHover = $state.raw<Position | null>(null);

	let drawingNow = false;
	let points: Point[] = [];
	let activePointer: number | null = null;
	let sawPen = false;
	let straight: StraightRun | null = null;
	let realPressure = $state(false);

	let overBoard = $derived(
		hover !== null && hover.x >= 0 && hover.y >= 0 && hover.x <= board.w && hover.y <= board.h
	);

	let layers = $derived.by(() => {
		const strokes = drawing.strokes;

		return eraseLayers(strokes).map((layer) => ({
			erasers: layer.erasers.map<EraserPath>((index) => ({
				d: polylinePath(strokes[index].points),
				width: strokes[index].size
			})),
			ink: layer.ink.map<InkPath>((index) => {
				const stroke = strokes[index];

				return {
					id: stroke.id,
					d: strokePath(stroke.pen, stroke.size, stroke.points, true, stroke.shape),
					color: stroke.color,
					opacity: stroke.opacity,
					blend: PEN_BY_ID[stroke.pen].blend === 'multiply',
					dot: stroke.points.length
						? {
								x: stroke.points[0][0],
								y: stroke.points[0][1],
								r: dotRadius(stroke.size)
							}
						: null
				};
			})
		}));
	});

	const surface: Attachment<SVGSVGElement> = (node) => {
		surfaceNode = node;
	};

	function runPoints(from: Point, to: Point, pressure: number): Point[] {
		const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
		const steps = Math.max(1, Math.round(distance / 3));

		return Array.from({ length: steps }, (_, index) => {
			const progress = (index + 1) / steps;
			return [
				from[0] + (to[0] - from[0]) * progress,
				from[1] + (to[1] - from[1]) * progress,
				pressure
			];
		});
	}

	function toBoard(clientX: number, clientY: number): Position {
		const bounds = surfaceNode.getBoundingClientRect();
		const scale = Math.min(bounds.width / board.w, bounds.height / board.h);
		const offsetX = (bounds.width - board.w * scale) / 2;
		const offsetY = (bounds.height - board.h * scale) / 2;

		return {
			x: (clientX - bounds.left - offsetX) / scale,
			y: (clientY - bounds.top - offsetY) / scale
		};
	}

	function shouldIgnore(event: PointerEvent): boolean {
		if (disabled) return true;
		if (event.pointerType === 'pen') sawPen = true;
		return event.pointerType === 'touch' && sawPen;
	}

	function handlePointerDown(event: PointerEvent): void {
		if (shouldIgnore(event) || activePointer !== null) return;

		event.preventDefault();
		activePointer = event.pointerId;
		surfaceNode.setPointerCapture(event.pointerId);

		const { x, y } = toBoard(event.clientX, event.clientY);
		const point: Point = [x, y, event.pressure || 0.5];

		drawingNow = true;
		straight = null;
		realPressure = false;
		points = [point];
		current = points;
	}

	function handlePointerMove(event: PointerEvent): void {
		if (shouldIgnore(event)) return;

		const position = toBoard(event.clientX, event.clientY);
		if (event.pointerType !== 'touch') {
			hover = position;
			lastHover = position;
		}

		if (!drawingNow || event.pointerId !== activePointer) return;

		if (event.pointerType === 'pen' && event.pressure > 0 && event.pressure !== 0.5) {
			realPressure = true;
		}

		const pressure = event.pressure || 0.5;

		if (event.shiftKey) {
			straight ??= {
				anchor: points.at(-1) ?? [position.x, position.y, pressure],
				heading: null,
				settled: points
			};

			const deltaX = position.x - straight.anchor[0];
			const deltaY = position.y - straight.anchor[1];

			if (straight.heading === null) {
				if (Math.hypot(deltaX, deltaY) < 16) return;
				straight.heading = (Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) * Math.PI) / 4;
			}

			const cosine = Math.cos(straight.heading);
			const sine = Math.sin(straight.heading);
			const distance = deltaX * cosine + deltaY * sine;
			const tip: Point = [
				straight.anchor[0] + cosine * distance,
				straight.anchor[1] + sine * distance,
				pressure
			];

			points = [...straight.settled, ...runPoints(straight.anchor, tip, pressure)];
			current = points;
			return;
		}

		straight = null;
		const last = points.at(-1);
		if (last && Math.hypot(position.x - last[0], position.y - last[1]) < 1.1) return;

		points = [...points, [position.x, position.y, pressure]];
		current = points;
	}

	function endGesture(event: PointerEvent): void {
		if (event.pointerId !== activePointer) return;
		activePointer = null;
		if (!drawingNow) return;

		drawingNow = false;
		straight = null;

		const finished = points;
		points = [];
		current = [];
		if (finished.length === 0) return;

		drawing.commit([
			...drawing.strokes,
			tool.kind === 'eraser'
				? {
						id: nextId(),
						pen: 'pen',
						color: '#000',
						size: tool.size,
						opacity: 1,
						points: finished,
						erase: true
					}
				: {
						id: nextId(),
						pen: tool.pen,
						color: tool.color,
						size: tool.size,
						opacity: tool.opacity,
						points: finished,
						shape: { ...tool.shape, simulatePressure: !realPressure }
					}
		]);
	}

	function handlePointerLeave(event: PointerEvent): void {
		hover = null;
		endGesture(event);
	}

	function isPale(color: string): boolean {
		const match = /^#?([\da-f]{6})$/i.exec(color.trim());
		if (!match) return false;

		const value = Number.parseInt(match[1], 16);
		const luminance =
			0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255);
		return luminance / 255 > 0.72;
	}
</script>

{#snippet brushCursor(selectedTool: Tool, at: Position)}
	{@const onDark = !isPale(background) && background !== 'transparent'}
	{@const radius = Math.max(selectedTool.size / 2, 3.5)}
	{@const cursorStroke = onDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.62)'}
	{#if !onDark}
		<circle
			cx={at.x}
			cy={at.y}
			r={radius}
			fill="none"
			stroke="rgba(255,255,255,0.92)"
			stroke-width="3"
		/>
	{/if}
	{#if selectedTool.kind === 'eraser'}
		<circle
			cx={at.x}
			cy={at.y}
			r={radius}
			fill={onDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
			stroke={cursorStroke}
			stroke-width="1"
		/>
		{#if !onDark}
			<path
				d={`M${at.x - 3} ${at.y}h6M${at.x} ${at.y - 3}v6`}
				stroke="rgba(255,255,255,0.9)"
				stroke-width="2.5"
			/>
		{/if}
		<path
			d={`M${at.x - 3} ${at.y}h6M${at.x} ${at.y - 3}v6`}
			stroke={cursorStroke}
			stroke-width="1"
		/>
	{:else}
		<circle cx={at.x} cy={at.y} r={radius} fill="none" stroke={cursorStroke} stroke-width="1" />
	{/if}
{/snippet}

<svg
	{@attach surface}
	role="application"
	aria-label="Drawing surface"
	width="100%"
	height="100%"
	viewBox={`0 0 ${board.w} ${board.h}`}
	class={className}
	{style}
	style:display="block"
	style:pointer-events={disabled ? 'none' : undefined}
	style:touch-action={disabled ? 'auto' : 'none'}
	style:user-select={disabled ? 'auto' : 'none'}
	style:-webkit-user-select={disabled ? 'auto' : 'none'}
	style:-webkit-tap-highlight-color="transparent"
	style:cursor={disabled ? 'default' : showBrushCursor ? 'none' : 'crosshair'}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={endGesture}
	onpointercancel={endGesture}
	onpointerleave={handlePointerLeave}
	oncontextmenu={(event) => event.preventDefault()}
>
	<defs>
		<pattern id={`c-${uid}`} width="16" height="16" patternUnits="userSpaceOnUse">
			<rect width="16" height="16" fill="#fff" />
			<rect width="8" height="8" fill="#ececec" />
			<rect x="8" y="8" width="8" height="8" fill="#ececec" />
		</pattern>
		<clipPath id={`b-${uid}`}>
			<rect x="0" y="0" width={board.w} height={board.h} />
		</clipPath>
	</defs>

	<g>
		<rect
			x="0"
			y="0"
			width={board.w}
			height={board.h}
			fill={background === 'transparent'
				? 'none'
				: background === 'checker'
					? `url(#c-${uid})`
					: background}
		/>

		<g clip-path={`url(#b-${uid})`}>
			{#each layers as layer, layerIndex (layerIndex)}
				{@const live =
					tool.kind === 'eraser' && current.length > 0 && layerIndex === layers.length - 1
						? [{ d: polylinePath(current), width: tool.size }]
						: []}
				{@const cuts = [...layer.erasers, ...live]}
				{@const maskId = `e-${uid}-${layerIndex}`}
				<g mask={cuts.length ? `url(#${maskId})` : undefined}>
					{#if cuts.length > 0}
						<defs>
							<mask
								id={maskId}
								maskUnits="userSpaceOnUse"
								x="0"
								y="0"
								width={board.w}
								height={board.h}
							>
								<rect x="0" y="0" width={board.w} height={board.h} fill="#fff" />
								{#each cuts as cut, cutIndex (cutIndex)}
									<path
										d={cut.d}
										fill="none"
										stroke="#000"
										stroke-width={cut.width}
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								{/each}
							</mask>
						</defs>
					{/if}

					{#each layer.ink as stroke (stroke.id)}
						{#if stroke.d}
							<path
								d={stroke.d}
								fill={stroke.color}
								fill-opacity={stroke.opacity}
								style:mix-blend-mode={stroke.blend ? 'multiply' : undefined}
							/>
						{:else if stroke.dot}
							<circle
								cx={stroke.dot.x}
								cy={stroke.dot.y}
								r={stroke.dot.r}
								fill={stroke.color}
								fill-opacity={stroke.opacity}
								style:mix-blend-mode={stroke.blend ? 'multiply' : undefined}
							/>
						{/if}
					{/each}
				</g>
			{/each}

			{#if tool.kind === 'pen' && current.length > 0}
				<path
					d={strokePath(tool.pen, tool.size, current, false, {
						...tool.shape,
						simulatePressure: !realPressure
					})}
					fill={tool.color}
					fill-opacity={tool.opacity}
					style:mix-blend-mode={PEN_BY_ID[tool.pen].blend === 'multiply' ? 'multiply' : undefined}
				/>
			{/if}
		</g>

		{#if showBrushCursor && lastHover}
			<g opacity={overBoard ? 1 : 0} style:transition="opacity 120ms ease" pointer-events="none">
				{@render brushCursor(tool, lastHover)}
			</g>
		{/if}
	</g>
</svg>
