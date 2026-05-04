import { expect, test } from '@playwright/test'

test.describe('portal flows', () => {
  test('student can log in and view the results page', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('you@example.com').fill('student@example.com')
    await page.getByPlaceholder('••••••••').fill('Student123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL(/\/student$/)
    await expect(page.getByText('Student Portal')).toBeVisible()

    await page.getByRole('link', { name: 'Results & Feedback' }).click()
    await expect(page).toHaveURL(/\/student\/results$/)
  })

  test('reviewer can sign out from the portal shell', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('you@example.com').fill('reviewer@example.com')
    await page.getByPlaceholder('••••••••').fill('Reviewer123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL(/\/reviewer$/)
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})