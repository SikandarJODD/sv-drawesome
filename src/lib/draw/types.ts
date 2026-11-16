import type { Board, Pen, PenId, Stroke, StrokeShape, ToolId } from './engine/types';
import type { DrawingController } from './state/drawing-controller.svelte';

export type DrawControls = {
	color?: boolean;
	size?: boolean;
	opacity?: boolean;
	undo?: boolean;
	clear?: boolean;
	custom?: boolean;
	minimize?: boolean;
};

export type InkMode = 'shared' | 'per-tool' | 'auto';
export type MotionPreset = 'rise' | 'none';
export type Placement = 'bottom' | 'left' | 'right';
export type Alignment = 'start' | 'center' | 'end';
export type MinimizeAlignment = 'start' | 'end';
export type Theme = 'light' | 'dark' | 'auto';
export type SettingsPlacement = 'bar' | 'tool';
export type ToolLook = 'classic' | 'studio';
export type Depth = 'flat' | 'soft' | 'regular' | 'strong';

export type MotionOptions = {
	in?: MotionPreset;
	out?: MotionPreset;
	duration?: number;
};

export type TooltipStyle = Record<string, string | number | null | undefined>;

export type TooltipOptions = {
	scope?: 'all' | 'tools';
	delay?: number;
	style?: TooltipStyle;
};

export type ToolState = {
	active: ToolId;
	color: string;
	size: number;
	opacity: number;
	eraserSize: number;
};

export type Tool =
	| {
			kind: 'pen';
			pen: PenId;
			color: string;
			size: number;
			opacity: number;
			shape?: StrokeShape;
	  }
	| { kind: 'eraser'; size: number };

export type DrawSurfaceProps = {
	drawing: DrawingController;
	board: Board;
	background?: string;
	tool: Tool;
	showBrushCursor?: boolean;
	disabled?: boolean;
	class?: string;
	style?: string;
};

export type DrawProps = {
	board?: Board;
	background?: string;
	initialStrokes?: Stroke[];
	onChange?: (strokes: Stroke[]) => void;
	chrome?: boolean;
	motion?: MotionPreset | MotionOptions;
	placement?: Placement;
	inset?: number | string;
	align?: Alignment;
	minimizeAlign?: MinimizeAlignment;
	theme?: Theme;
	drawWhenMinimized?: boolean;
	startMinimized?: boolean;
	shortcuts?: boolean;
	swatches?: string[];
	tooltips?: boolean | TooltipOptions;
	tools?: PenId[];
	eraser?: boolean;
	controls?: DrawControls;
	settings?: SettingsPlacement;
	look?: ToolLook;
	gauge?: boolean;
	draggable?: boolean;
	ink?: InkMode;
	depth?: Depth;
	class?: string;
	style?: string;
};

export type DrawHandle = {
	toSvg: () => string;
	toPng: (scale?: number) => Promise<Blob>;
	download: (name?: string, format?: 'svg' | 'png', scale?: number) => Promise<void>;
	getStrokes: () => Stroke[];
	setStrokes: (strokes: Stroke[]) => void;
	undo: () => void;
	redo: () => void;
	clear: () => void;
	getSize: () => Board;
};

export type ToolbarOptions = {
	pens?: Pen[];
	eraser?: boolean;
	controls?: DrawControls;
	settings?: SettingsPlacement;
	theme?: Theme;
	look?: ToolLook;
	gauge?: boolean;
	shortcuts?: boolean;
	swatches?: string[];
	tooltips?: boolean | TooltipOptions;
	placement?: Placement;
};
