<script lang="ts">
	import styles from '../styles/bar-slider.module.css';

	type Props = {
		label: string;
		value: number;
		min: number;
		max: number;
		curve?: number;
		display: string;
		color: string;
		checker?: boolean;
		vertical?: boolean;
		onchange: (value: number) => void;
	};

	let {
		label,
		value,
		min,
		max,
		curve = 1,
		display,
		color,
		checker = false,
		vertical = false,
		onchange
	}: Props = $props();

	let track: HTMLDivElement;
	let dragging = false;
	let tracking = $state(false);
	let pressedAt = 0;

	const knobSize = 16;
	let percentage = $derived(Math.pow((value - min) / (max - min), 1 / curve));
	let position = $derived(`calc(${knobSize / 2}px + ${percentage} * (100% - ${knobSize}px))`);
	let step = $derived((max - min) / 50);

	function attachTrack(node: HTMLDivElement): void {
		track = node;
	}

	function valueAt(clientX: number, clientY: number): number {
		const bounds = track.getBoundingClientRect();
		const length = Math.max(1, (vertical ? bounds.height : bounds.width) - knobSize);
		const offset = vertical
			? bounds.bottom - clientY - knobSize / 2
			: clientX - bounds.left - knobSize / 2;
		const progress = Math.min(1, Math.max(0, offset / length));

		return min + (max - min) * Math.pow(progress, curve);
	}

	function handlePointerDown(event: PointerEvent): void {
		event.preventDefault();
		track.setPointerCapture(event.pointerId);
		dragging = true;
		tracking = false;
		pressedAt = vertical ? event.clientY : event.clientX;
		onchange(valueAt(event.clientX, event.clientY));
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!dragging) return;

		const pointerPosition = vertical ? event.clientY : event.clientX;
		if (Math.abs(pointerPosition - pressedAt) > 4) tracking = true;
		onchange(valueAt(event.clientX, event.clientY));
	}

	function stopDragging(): void {
		dragging = false;
		tracking = false;
	}

	function handleKeydown(event: KeyboardEvent): void {
		const increase = vertical ? 'ArrowUp' : 'ArrowRight';
		const decrease = vertical ? 'ArrowDown' : 'ArrowLeft';

		if (event.key === increase) onchange(Math.min(max, value + step));
		if (event.key === decrease) onchange(Math.max(min, value - step));
	}
</script>

<div class={[styles.field, vertical && styles.fieldVertical]}>
	<div class={styles.head}>
		<span class={styles.label}>{label}</span>
		<span class={styles.value}>{display}</span>
	</div>
	<div
		{@attach attachTrack}
		class={[styles.track, vertical && styles.trackVertical]}
		data-dragging={tracking || undefined}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={stopDragging}
		onpointercancel={stopDragging}
		onkeydown={handleKeydown}
		role="slider"
		aria-label={label}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-valuetext={display}
		tabindex="0"
	>
		<span class={styles.groove}>
			{#if checker}<span class={styles.checker}></span>{/if}
			<span
				class={styles.fill}
				style:width={vertical ? undefined : position}
				style:height={vertical ? position : undefined}
				style:background={color}
			></span>
		</span>
		<span
			class={styles.knob}
			style:left={vertical ? undefined : position}
			style:bottom={vertical ? position : undefined}
		></span>
	</div>
</div>
