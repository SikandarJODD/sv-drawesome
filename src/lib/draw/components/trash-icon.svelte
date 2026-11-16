<script lang="ts">
	import styles from '../styles/trash-icon.module.css';

	let { size = 16 }: { size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={styles.icon}
>
	<path d="M4.9 7.5v3.9a2.3 2.3 0 0 0 2.3 2.3h1.6a2.3 2.3 0 0 0 2.3-2.3V7.5" />
	<g class={styles.lid}>
		<path d="M3.5 5.6h9" />
		<path d="M6.8 5.6V4.5a1.2 1.2 0 0 1 1.2-1.2 1.2 1.2 0 0 1 1.2 1.2v1.1" />
	</g>
</svg>
