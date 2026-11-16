import { onDestroy } from 'svelte';
import type { Placement, TooltipOptions } from '../types';

export type TooltipFace = { label: string; hint?: string };
export type TooltipPosition = 'top' | 'right' | 'left';
export type ShownTooltip = TooltipFace & {
	x: number;
	y: number;
	at: TooltipPosition;
};

type TooltipSetting = boolean | TooltipOptions | undefined;
type Timer = ReturnType<typeof setTimeout> | null;

const swapDuration = 260;
const exitDuration = 170;

export class TooltipController {
	shown = $state<ShownTooltip | null>(null);
	leaving = $state<TooltipFace | null>(null);
	width = $state<number | null>(null);
	swap = $state(0);
	closing = $state(false);

	#tooltips: () => TooltipSetting;
	#placement: () => Placement;
	#open = false;
	#delay: Timer = null;
	#leave: Timer = null;
	#settle: Timer = null;
	#exit: Timer = null;

	constructor(tooltips: () => TooltipSetting, placement: () => Placement) {
		this.#tooltips = tooltips;
		this.#placement = placement;
	}

	get enabled(): boolean {
		return this.#tooltips() !== false;
	}

	get style(): string | undefined {
		const options = this.#tooltips();
		return typeof options === 'object' ? options.style : undefined;
	}

	get toolsOnly(): boolean {
		const options = this.#tooltips();
		return typeof options === 'object' && options.scope === 'tools';
	}

	get wait(): number {
		const options = this.#tooltips();
		return typeof options === 'object' ? (options.delay ?? 400) : 400;
	}

	#clear(timer: Timer): null {
		if (timer !== null) clearTimeout(timer);
		return null;
	}

	hide = (immediate = false): void => {
		this.#delay = this.#clear(this.#delay);
		this.#leave = this.#clear(this.#leave);

		const close = () => {
			this.closing = true;
			this.#exit = this.#clear(this.#exit);
			this.#exit = setTimeout(() => {
				this.#open = false;
				this.shown = null;
				this.leaving = null;
				this.width = null;
				this.closing = false;
			}, exitDuration);
		};

		if (immediate) close();
		else this.#leave = setTimeout(close, 130);
	};

	show = (element: HTMLElement, label: string, hint?: string): void => {
		if (!this.enabled) return;

		this.#delay = this.#clear(this.#delay);
		this.#leave = this.#clear(this.#leave);
		this.#exit = this.#clear(this.#exit);
		this.closing = false;

		const place = () => {
			const bounds = element.getBoundingClientRect();
			const placement = this.#placement();
			const at: TooltipPosition =
				placement === 'left' ? 'right' : placement === 'right' ? 'left' : 'top';
			const x = Math.round(
				at === 'right'
					? bounds.right + 12
					: at === 'left'
						? bounds.left - 12
						: bounds.left + bounds.width / 2
			);
			const y = Math.round(at === 'top' ? bounds.top - 10 : bounds.top + bounds.height / 2);

			if (this.shown && this.shown.label !== label) {
				this.leaving = { label: this.shown.label, hint: this.shown.hint };
				this.swap += 1;
				this.#settle = this.#clear(this.#settle);
				this.#settle = setTimeout(() => (this.leaving = null), swapDuration);
			}

			this.shown = { label, hint, x, y, at };
			this.#open = true;
		};

		if (this.#open) place();
		else this.#delay = setTimeout(place, this.wait);
	};

	bind = (label: string, hint?: string) => ({
		onpointerenter: (event: PointerEvent & { currentTarget: HTMLElement }) => {
			if (event.pointerType !== 'touch') this.show(event.currentTarget, label, hint);
		},
		onpointerleave: () => this.hide(),
		onpointerdown: () => this.hide(true),
		onfocus: (event: FocusEvent & { currentTarget: HTMLElement }) => {
			if (event.currentTarget.matches(':focus-visible')) {
				this.show(event.currentTarget, label, hint);
			}
		},
		onblur: () => this.hide()
	});

	bindControl = (label: string, hint?: string) => (this.toolsOnly ? {} : this.bind(label, hint));

	destroy(): void {
		this.#delay = this.#clear(this.#delay);
		this.#leave = this.#clear(this.#leave);
		this.#settle = this.#clear(this.#settle);
		this.#exit = this.#clear(this.#exit);
	}
}

export function createTooltipController(
	tooltips: () => TooltipSetting,
	placement: () => Placement
): TooltipController {
	const controller = new TooltipController(tooltips, placement);
	onDestroy(() => controller.destroy());
	return controller;
}
