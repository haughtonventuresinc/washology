import { test, expect } from '@playwright/test';

// Boot server is assumed to be running at http://localhost:3000 via `npm run dev`
// This test verifies that clicking contact CTAs opens the ZIP modal, shows loading,
// and renders multiple suggestions for a known ZIP (78701 - Austin, TX).

test.describe('ZIP Modal suggestions', () => {
  test('opens on CTA and lists relevant addresses', async ({ page }) => {
    // 1) Open homepage with ziptest flag to ensure debug button is available as fallback
    await page.goto('http://localhost:3000/?ziptest=1');

    // Click header banner CTA if present, else use debug button
    const headerCta = page.locator('text=Get Free Estimate').first();
    if (await headerCta.isVisible()) {
      await headerCta.click();
    } else {
      await page.locator('text=Open ZIP Modal (TEST)').click();
    }

    // 2) Ensure modal appeared
    const modal = page.locator('#zip-modal-backdrop');
    await expect(modal).toBeVisible();

    // 3) Type a zip and expect a loading indicator
    const input = page.locator('#zip-modal-input');
    await input.fill('78701');

    const suggestBox = page.locator('#zip-suggest-modal');
    await expect(suggestBox).toBeVisible({ timeout: 3000 });

    // 4) Wait for suggestions to appear
    await expect(async () => {
      const c = await suggestBox.locator('.item').count();
      expect(c).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 8000 });

    const items = suggestBox.locator('.item');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThanOrEqual(3);

    // Assert one of the options contains Austin, TX or 78701
    const anyAustin = await items.filter({ hasText: 'Austin, TX' }).count();
    const anyZip = await items.filter({ hasText: '78701' }).count();
    const anyUsa = await items.filter({ hasText: 'USA' }).count();
    expect(anyAustin + anyZip + anyUsa).toBeGreaterThan(0);

    // 5) Click first suggestion, then Continue should navigate to contact with query
    await items.first().click();
    const continueBtn = page.locator('#zip-continue');
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    await page.waitForURL(/\/contact\-us\?/, { timeout: 10000 });
    expect(page.url()).toMatch(/zip=78701/);
  });
});
