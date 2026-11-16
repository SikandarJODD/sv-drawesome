/** How many swatches the horizontal bar can hold. */
export const MAX_SWATCHES = 18;

/** How many swatches a compact vertical rail can hold. */
export const MAX_SWATCHES_COMPACT = 9;

export const SWATCHES = [
	'#111111',
	'#5c5c5c',
	'#9a9a9a',
	'#ffffff',
	'#a83129',
	'#e03131',
	'#f76707',
	'#f59f00',
	'#ffd43b',
	'#74b816',
	'#2f9e44',
	'#0ca678',
	'#1098ad',
	'#1c7ed6',
	'#4263eb',
	'#7048e8',
	'#ae3ec9',
	'#d6336c'
] as const;

/** A shorter palette for vertical rails. */
export const SWATCHES_COMPACT = [
	'#111111',
	'#9a9a9a',
	'#ffffff',
	'#e03131',
	'#f76707',
	'#ffd43b',
	'#2f9e44',
	'#1c7ed6',
	'#7048e8'
] as const;

/** Return the palette appropriate for the toolbar orientation. */
export function resolveSwatches(custom: readonly string[] | undefined, compact: boolean): string[] {
	const maximum = compact ? MAX_SWATCHES_COMPACT : MAX_SWATCHES;

	if (custom) return custom.slice(0, maximum);

	return [...(compact ? SWATCHES_COMPACT : SWATCHES)];
}
