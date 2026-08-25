import { Page, Browser } from 'playwright';
import { SubmissionResult } from './types';
import { verifySubmissionOutcome } from './verifySubmission';

interface PendingOtpSession {
  applicationId: string;
  page: Page;
  browser: Browser;
  resolve?: (result: SubmissionResult) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: number;
}

const pendingSessions = new Map<string, PendingOtpSession>();

/**
 * Registers an active Playwright browser page waiting for OTP code input.
 */
export function registerPendingOtpSession(
  applicationId: string,
  page: Page,
  browser: Browser,
  resolve?: (result: SubmissionResult) => void
): void {
  // Clear existing session for this applicationId if present
  if (pendingSessions.has(applicationId)) {
    const existing = pendingSessions.get(applicationId)!;
    clearTimeout(existing.timeoutId);
    existing.browser.close().catch(() => {});
  }

  // Set 5-minute timeout for OTP entry
  const timeoutId = setTimeout(async () => {
    console.warn(`[OTPResolver] ⏱️ OTP session timed out for application ${applicationId}`);
    if (pendingSessions.has(applicationId)) {
      const session = pendingSessions.get(applicationId)!;
      pendingSessions.delete(applicationId);
      await session.browser.close().catch(() => {});
      if (session.resolve) {
        session.resolve({
          success: false,
          isConfirmed: false,
          requiresOtp: true,
          failureReason: 'UNKNOWN',
          error: 'OTP entry timed out after 5 minutes.',
        });
      }
    }
  }, 5 * 60 * 1000);

  pendingSessions.set(applicationId, {
    applicationId,
    page,
    browser,
    resolve,
    timeoutId,
    createdAt: Date.now(),
  });

  console.log(`[OTPResolver] 🔑 Registered pending OTP session for application ${applicationId}`);
}

/**
 * Checks if an application has an active OTP session.
 */
export function hasPendingOtpSession(applicationId: string): boolean {
  return pendingSessions.has(applicationId);
}

/**
 * Injects the candidate's 8-character security code into the pending Playwright page.
 */
export async function submitOtpCode(
  applicationId: string,
  code: string
): Promise<SubmissionResult> {
  const session = pendingSessions.get(applicationId);
  if (!session) {
    throw new Error(`No active OTP session found for application ID ${applicationId}. Session may have expired.`);
  }

  clearTimeout(session.timeoutId);
  pendingSessions.delete(applicationId);

  const { page, browser, resolve } = session;

  try {
    const cleanCode = code.trim().replace(/\s+/g, '');
    console.log(`[OTPResolver] Injecting ${cleanCode.length}-character security code into application ${applicationId}...`);

    // 1. Check for multi-box OTP input pattern (8 individual inputs like Greenhouse)
    const singleCharInputs = page.locator('input[maxlength="1"], input[size="1"], fieldset input, div[class*="security"] input');
    const inputCount = await singleCharInputs.count();

    if (inputCount >= cleanCode.length) {
      console.log(`[OTPResolver] Found ${inputCount} single-character OTP input boxes.`);
      for (let i = 0; i < cleanCode.length; i++) {
        const charInput = singleCharInputs.nth(i);
        await charInput.click({ force: true }).catch(() => {});
        await charInput.fill(cleanCode[i]).catch(() => {});
        await page.waitForTimeout(50);
      }
    } else {
      // 2. Fallback to single text/search input
      const codeInput = page.locator('input[name*="code" i], input[id*="code" i], input[placeholder*="code" i], input[autocomplete="one-time-code"]').first();
      if (await codeInput.isVisible().catch(() => false)) {
        await codeInput.click({ force: true }).catch(() => {});
        await codeInput.fill(cleanCode).catch(() => {});
      } else {
        // Press sequentially on page
        await page.keyboard.type(cleanCode, { delay: 50 });
      }
    }

    await page.waitForTimeout(500);

    // 3. Click Submit button
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit application"), button:has-text("Submit")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click({ force: true }).catch(() => {});
      console.log(`[OTPResolver] Clicked Submit application button.`);
    } else {
      await page.keyboard.press('Enter').catch(() => {});
    }

    await page.waitForTimeout(3000);

    // 4. Verify outcome post-OTP submit
    const verification = await verifySubmissionOutcome(page, page.url());
    const screenshotFileName = `otp_verified_${Date.now()}.png`;
    const screenshotPath = `/home/rishu/Documents/tsenta-for-voice-ai/backend/uploads/screenshots/${screenshotFileName}`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    await browser.close().catch(() => {});

    const result: SubmissionResult = {
      success: verification.success,
      isConfirmed: verification.isConfirmed,
      failureReason: verification.failureReason,
      validationMessages: verification.validationMessages,
      screenshotUrl: `/uploads/screenshots/${screenshotFileName}`,
      error: verification.errorDetails,
      submittedAt: verification.success ? new Date() : undefined,
    };

    if (resolve) resolve(result);
    return result;
  } catch (err: any) {
    console.error(`[OTPResolver] Failed to inject OTP code:`, err.message);
    await browser.close().catch(() => {});
    const failResult: SubmissionResult = {
      success: false,
      isConfirmed: false,
      failureReason: 'UNKNOWN',
      error: `OTP injection failed: ${err.message}`,
    };
    if (resolve) resolve(failResult);
    return failResult;
  }
}
