// Конфіг UI-тестів. Це єдині тести, яким потрібен справжній браузер:
// решта (`npm test`, Jest) перевіряє чисті функції без DOM.
//
// Локально стандартний бінарник Chromium може не збігтися версією з тим, що
// вже стоїть у системі — тоді шлях до нього передається через
// UI_TEST_CHROMIUM. У CI браузер ставить `npx playwright install chromium`,
// і змінна не потрібна.
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.UI_TEST_PORT) || 8123;
const CHROMIUM = process.env.UI_TEST_CHROMIUM;

module.exports = defineConfig({
  testDir: './ui-tests',
  // Сторінки модулів тримають стан у localStorage і в service worker —
  // паралельні вкладки на одному походженні заважали б одна одній.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node ui-tests/server.js`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
