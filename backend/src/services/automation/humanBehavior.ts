import { BrowserContext, Page, Locator } from 'playwright';

// Helper for random delay range
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Current mouse position tracker per page
const mousePositions = new WeakMap<Page, { x: number; y: number }>();

function getMousePosition(page: Page): { x: number; y: number } {
  return mousePositions.get(page) || { x: 100, y: 100 };
}

function setMousePosition(page: Page, pos: { x: number; y: number }) {
  mousePositions.set(page, pos);
}

/**
 * Advanced Browser Stealth Fingerprint Overrides
 */
export async function applyAdvancedStealthOverrides(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // 1. Mask navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // 2. Mock chrome runtime & app objects
    (window as any).chrome = {
      runtime: {
        id: 'ejbalbakoplchlghecdalmeeeajnimhm',
        connect: () => {},
        sendMessage: () => {},
      },
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
      },
      csi: () => {},
      loadTimes: () => {},
    };

    // 3. Mock languages & plugins
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbdfcadgajjhblddmgicfgcecmoao', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ],
    });

    // 4. Overwrite WebGL Vendor & Renderer to realistic GPU
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      // UNMASKED_VENDOR_WEBGL
      if (parameter === 37445) return 'Google Inc. (NVIDIA)';
      // UNMASKED_RENDERER_WEBGL
      if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      return getParameter.apply(this, [parameter]);
    };

    // 5. Spoof Permissions API for Notifications
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      (window.navigator.permissions as any).query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission as PermissionState || 'prompt' })
          : originalQuery(parameters);
    }
  });
}

/**
 * Human-like Variable Keystroke Typist
 * Types with random delays (45-120ms), pauses after punctuation, and rare typo corrections.
 */
export async function humanType(page: Page, locator: Locator, text: string): Promise<void> {
  if (!text) return;

  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await humanMoveAndClick(page, locator);
  
  // Clear input first
  await locator.fill('').catch(() => {});
  await randomDelay(100, 250);

  const typoPool = 'abcdefghijklmnopqrstuvwxyz';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 2% chance of realistic typo followed by Backspace (only on letters)
    if (Math.random() < 0.02 && /[a-zA-Z]/.test(char)) {
      const wrongChar = typoPool[Math.floor(Math.random() * typoPool.length)];
      await page.keyboard.type(wrongChar, { delay: Math.floor(Math.random() * 40) + 40 });
      await randomDelay(150, 350);
      await page.keyboard.press('Backspace');
      await randomDelay(100, 200);
    }

    // Type actual character
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 60) + 45 });

    // Extra micro-pause after space, punctuation, or capital letter
    if (/[.\s@,!?]/.test(char) || /[A-Z]/.test(char)) {
      await randomDelay(100, 250);
    }
  }

  await randomDelay(150, 300);
}

/**
 * Physics-based Cubic Bezier Curve Mouse Cursor Movement & Click
 */
export async function humanMoveAndClick(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) {
    await locator.click({ force: true }).catch(() => {});
    return;
  }

  const start = getMousePosition(page);
  // Target center of target bounding box with small random offset
  const targetX = box.x + box.width / 2 + (Math.random() * 6 - 3);
  const targetY = box.y + box.height / 2 + (Math.random() * 6 - 3);

  // Generate cubic Bezier control points for natural curve
  const controlX1 = start.x + (targetX - start.x) * 0.25 + (Math.random() * 100 - 50);
  const controlY1 = start.y + (targetY - start.y) * 0.25 + (Math.random() * 100 - 50);
  const controlX2 = start.x + (targetX - start.x) * 0.75 + (Math.random() * 100 - 50);
  const controlY2 = start.y + (targetY - start.y) * 0.75 + (Math.random() * 100 - 50);

  const steps = 15 + Math.floor(Math.random() * 10);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Cubic Bezier curve formula
    const x = Math.pow(1 - t, 3) * start.x +
      3 * Math.pow(1 - t, 2) * t * controlX1 +
      3 * (1 - t) * Math.pow(t, 2) * controlX2 +
      Math.pow(t, 3) * targetX;

    const y = Math.pow(1 - t, 3) * start.y +
      3 * Math.pow(1 - t, 2) * t * controlY1 +
      3 * (1 - t) * Math.pow(t, 2) * controlY2 +
      Math.pow(t, 3) * targetY;

    await page.mouse.move(x, y);
    await randomDelay(10, 25);
  }

  setMousePosition(page, { x: targetX, y: targetY });

  // Hover delay
  await randomDelay(80, 200);

  // Mouse down & up
  await page.mouse.down();
  await randomDelay(40, 90);
  await page.mouse.up();
  await randomDelay(100, 250);
}

/**
 * Natural Page Scrolling & Dwell Time Simulator
 */
export async function humanScrollAndDwell(page: Page, minDwellMs: number = 4000, maxDwellMs: number = 7000): Promise<void> {
  console.log('[HumanBehavior] Simulating human scrolling & form dwell reading time...');
  
  const startTime = Date.now();
  const targetDwell = Math.floor(Math.random() * (maxDwellMs - minDwellMs + 1)) + minDwellMs;

  while (Date.now() - startTime < targetDwell) {
    const scrollAmount = Math.floor(Math.random() * 250) + 100;
    const direction = Math.random() > 0.2 ? 1 : -1; // 80% down, 20% up

    await page.evaluate(({ amt, dir }) => {
      window.scrollBy({ top: amt * dir, behavior: 'smooth' });
    }, { amt: scrollAmount, dir: direction }).catch(() => {});

    await randomDelay(600, 1400);
  }

  console.log(`[HumanBehavior] Completed form dwell time (${Math.round((Date.now() - startTime) / 1000)}s).`);
}
