export { default as Draw } from './components/draw.svelte';
export { default as DrawSurface } from './components/draw-surface.svelte';
export { default as Toolbar } from './components/toolbar.svelte';
export { default as ToolIcon } from './components/tool-icon.svelte';
export type { ToolIconId } from './components/tool-icon.svelte';

export { getStroke } from './engine/freehand';
export type { FreehandOptions } from './engine/freehand';
export {
	dotRadius,
	eraseLayers,
	getSvgPathFromStroke,
	nextId,
	polylinePath,
	streamline,
	strokePath
} from './engine/geometry';
export { PEN_BY_ID, PENS } from './engine/pens';
export { toPng, toSvg } from './engine/serialize';
export type * from './engine/types';

export {
	MAX_SWATCHES,
	MAX_SWATCHES_COMPACT,
	SWATCHES,
	SWATCHES_COMPACT,
	resolveSwatches
} from './palette';
export { DrawingController, createDrawing } from './state/drawing-controller.svelte';
export type { StrokeUpdate } from './state/drawing-controller.svelte';
export type * from './types';
