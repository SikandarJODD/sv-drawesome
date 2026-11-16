import type { Attachment } from 'svelte/attachments';

export const portal: Attachment<HTMLElement> = (node) => {
	document.body.append(node);
	return () => node.remove();
};
