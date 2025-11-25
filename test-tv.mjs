import { chromium } from 'playwright';

async function testTV() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(2000);

  // Enter a YouTube URL and tune in
  const input = page.locator('input[placeholder*="FREQUENCY"]');
  await input.fill('https://www.youtube.com/watch?v=jfKfPfyJRdk'); // lofi girl
  await page.locator('button:has-text("TUNE")').click();
  console.log('Entered video URL and clicked TUNE');

  // Wait for video to load
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-1-video-loaded.png' });
  console.log('Screenshot 1: Video loaded');

  // Click the TV button
  const tvButton = page.locator('button[title="Toggle Monitor"]');
  await tvButton.click();
  console.log('Clicked TV button');

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-2-tv-with-video.png' });
  console.log('Screenshot 2: TV with video');

  // Check what's in the RetroTV player container
  const playerContainer = await page.evaluate(() => {
    const retroTV = document.querySelector('[style*="position: fixed"]');
    if (retroTV) {
      const playerDiv = retroTV.querySelector('div.w-full.h-full');
      return {
        found: true,
        innerHTML: playerDiv?.innerHTML?.substring(0, 500) || 'no inner HTML',
        hasIframe: !!retroTV.querySelector('iframe'),
        childCount: playerDiv?.childElementCount || 0
      };
    }
    return { found: false };
  });
  console.log('Player container:', playerContainer);

  // Check YouTube API state
  const ytState = await page.evaluate(() => {
    return {
      ytDefined: typeof window.YT !== 'undefined',
      ytPlayerDefined: typeof window.YT?.Player !== 'undefined',
    };
  });
  console.log('YouTube API:', ytState);

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-3-final.png' });
  console.log('Screenshot 3: Final');

  await browser.close();
}

testTV().catch(console.error);
