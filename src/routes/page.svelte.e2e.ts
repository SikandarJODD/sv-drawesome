import { expect, test } from '@playwright/test';

test('shows the drawing surface', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('Svelte Drawesome');
	await expect(page.getByRole('application', { name: 'Drawing surface' })).toBeVisible();
});
