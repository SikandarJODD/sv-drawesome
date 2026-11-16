<script module lang="ts">
	type EyeDropperConstructor = new () => {
		open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
	};

	declare global {
		interface Window {
			EyeDropper?: EyeDropperConstructor;
		}
	}

	let picking = false;

	export function supportsEyeDropper(): boolean {
		return typeof window !== 'undefined' && Boolean(window.EyeDropper);
	}

	export async function pickFromScreen(): Promise<string | null> {
		if (picking || !window.EyeDropper) return null;

		picking = true;
		const abort = new AbortController();
		const cancel = () => abort.abort();
		window.addEventListener('blur', cancel, { once: true });
		document.addEventListener('visibilitychange', cancel, { once: true });

		try {
			const { sRGBHex } = await new window.EyeDropper().open({ signal: abort.signal });
			return sRGBHex;
		} catch {
			// EyeDropper rejects when the picker is cancelled or focus loss aborts it.
			return null;
		} finally {
			picking = false;
			window.removeEventListener('blur', cancel);
			document.removeEventListener('visibilitychange', cancel);
		}
	}
</script>

<script lang="ts">
	import { watch } from '../internal/watch/watch.svelte';
	import styles from '../styles/hex-field.module.css';

	type Props = {
		value: string;
		onchange: (color: string) => void;
	};

	let { value, onchange }: Props = $props();
	let text = $state('');
	let editing = $state(false);

	watch(
		() => value,
		(next) => {
			if (!editing) text = next;
		}
	);

	function normalise(input: string): string | null {
		const hex = input.trim().replace(/^#/, '');

		if (/^[\da-f]{3}$/i.test(hex)) {
			return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
		}

		return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
	}
</script>

<span class={styles.hex}>
	<span aria-hidden="true">#</span>
	<input
		value={(editing ? text : value).replace(/^#/, '').toUpperCase()}
		spellcheck="false"
		autocomplete="off"
		inputmode="text"
		maxlength="6"
		aria-label="Hex colour"
		onfocus={() => {
			text = value;
			editing = true;
		}}
		oninput={(event) => {
			text = event.currentTarget.value;
			const color = normalise(text);
			if (color) onchange(color);
		}}
		onblur={() => {
			editing = false;
			text = value;
		}}
		onkeydown={(event) => {
			if (event.key === 'Enter') event.currentTarget.blur();
			event.stopPropagation();
		}}
	/>
</span>
