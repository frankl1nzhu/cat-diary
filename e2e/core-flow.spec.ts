import { test, expect } from '@playwright/test'

test('mobile core flow: login, navigate, modal open/close', async ({ page }) => {
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD

    test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated flow')

    await page.goto('/login')
    await page.getByLabel('邮箱').fill(email as string)
    await page.getByLabel('密码').fill(password as string)
    await page.getByRole('button', { name: '登录 🐾' }).click()

    await expect(page).not.toHaveURL(/\/login/)

    await page.getByRole('link', { name: '记录' }).click()
    await expect(page.getByRole('heading', { name: '📝 记录' })).toBeVisible()

    await page.getByRole('link', { name: '统计' }).click()
    await expect(page.getByRole('heading', { name: '📊 统计' })).toBeVisible()

    await page.getByRole('link', { name: '首页' }).click()
    await page.getByText('记录喂食').first().click()
    await expect(page.getByRole('heading', { name: '🍽️ 记录喂食' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: '🍽️ 记录喂食' })).toBeHidden()

    await page.getByText('记录喂食').first().click()
    await expect(page.getByRole('heading', { name: '🍽️ 记录喂食' })).toBeVisible()

    await page.mouse.click(6, 6)
    await expect(page.getByRole('heading', { name: '🍽️ 记录喂食' })).toBeHidden()
})
