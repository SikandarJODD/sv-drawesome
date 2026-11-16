import type { Stroke } from '../engine/types';

export type StrokeUpdate = Stroke[] | ((previous: Stroke[]) => Stroke[]);

/** Reactive stroke storage with undo/redo and gesture transactions. */
export class DrawingController {
	strokes = $state.raw<Stroke[]>([]);

	#past = $state.raw<Stroke[][]>([]);
	#future = $state.raw<Stroke[][]>([]);
	#snapshot: Stroke[] | null = null;

	canUndo = $derived(this.#past.length > 0);
	canRedo = $derived(this.#future.length > 0);

	constructor(initial: readonly Stroke[] = []) {
		this.strokes = [...initial];
	}

	/** Replace all strokes and record one history entry. */
	commit = (next: Stroke[]): void => {
		this.#past = [...this.#past, this.strokes];
		this.#future = [];
		this.strokes = next;
	};

	/** Begin a gesture whose intermediate updates should form one history entry. */
	begin = (): void => {
		this.#snapshot = this.strokes;
	};

	/** Update strokes without recording an intermediate history entry. */
	update = (next: StrokeUpdate): void => {
		this.strokes = typeof next === 'function' ? next(this.strokes) : next;
	};

	/** Finish the current gesture and record it when strokes changed. */
	end = (): void => {
		const before = this.#snapshot;
		this.#snapshot = null;

		if (!before || before === this.strokes) return;

		this.#past = [...this.#past, before];
		this.#future = [];
	};

	undo = (): void => {
		const previous = this.#past.at(-1);
		if (!previous) return;

		this.#past = this.#past.slice(0, -1);
		this.#future = [this.strokes, ...this.#future];
		this.strokes = previous;
	};

	redo = (): void => {
		const next = this.#future[0];
		if (!next) return;

		this.#future = this.#future.slice(1);
		this.#past = [...this.#past, this.strokes];
		this.strokes = next;
	};

	clear = (): void => {
		if (this.strokes.length === 0) return;
		this.commit([]);
	};

	/** Load strokes without recording history. */
	reset = (next: Stroke[]): void => {
		this.strokes = next;
		this.#past = [];
		this.#future = [];
		this.#snapshot = null;
	};
}

export function createDrawing(initial: readonly Stroke[] = []): DrawingController {
	return new DrawingController(initial);
}
