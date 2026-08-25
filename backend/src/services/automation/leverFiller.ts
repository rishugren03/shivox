import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ApplicantInfo, SubmissionResult } from './types';
import { verifySubmissionOutcome } from './verifySubmission';
import path from 'path';
import fs from 'fs';

// Apply stealth plugin stack
chromium.use(stealthPlugin());

export async function fillLeverApplication(
  url: string,
  applicant: ApplicantInfo,
  dryRun = false
): Promise<SubmissionResult> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-US',
  });

  // Anti-bot stealth init script
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    const applyUrl = url.includes('/apply') ? url : `${url}/apply`;
    console.log(`[LeverFiller] Navigating to ${applyUrl}`);
    await page.goto(applyUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });

    await page.waitForSelector('form, input, button', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Helper to safely fill inputs using human typing simulation
    const safeFill = async (labelRegex: RegExp, fallbackSelector: string, val?: string) => {
      if (!val) return;
      try {
        const byLabel = page.getByLabel(labelRegex).first();
        if (await byLabel.isVisible().catch(() => false)) {
          await byLabel.scrollIntoViewIfNeeded().catch(() => {});
          await byLabel.focus().catch(() => {});
          await byLabel.pressSequentially(val, { delay: 12 });
          return;
        }
      } catch (e: any) {}

      try {
        const fallback = page.locator(fallbackSelector).first();
        if (await fallback.isVisible().catch(() => false)) {
          await fallback.scrollIntoViewIfNeeded().catch(() => {});
          await fallback.focus().catch(() => {});
          await fallback.pressSequentially(val, { delay: 12 });
        }
      } catch (e: any) {}
    };

    await safeFill(/full name|name/i, 'input[name="name"], input[autocomplete="name"]', applicant.fullName);
    await safeFill(/email/i, 'input[name="email"], input[type="email"]', applicant.email);
    await safeFill(/phone/i, 'input[name="phone"], input[type="tel"]', applicant.phone || '555-019-2831');
    await safeFill(/company|org/i, 'input[name="org"]', 'AI Founding Team / Engineer');
    await safeFill(/linkedin/i, 'input[name*="LinkedIn"], input[name*="linkedin"]', applicant.linkedinUrl);
    await safeFill(/github/i, 'input[name*="GitHub"], input[name*="github"]', applicant.githubUrl);
    await safeFill(/portfolio|website/i, 'input[name*="Portfolio"], input[name*="other"]', applicant.portfolioUrl);

    // Cover letter / Additional Info comments
    if (applicant.coverNote) {
      try {
        const coverByLabel = page.getByLabel(/cover|comments|additional/i).first();
        if (await coverByLabel.isVisible().catch(() => false)) {
          await coverByLabel.scrollIntoViewIfNeeded().catch(() => {});
          await coverByLabel.focus().catch(() => {});
          await coverByLabel.pressSequentially(applicant.coverNote, { delay: 5 });
        } else {
          const textarea = page.locator('textarea[name="comments"], textarea').first();
          if (await textarea.isVisible().catch(() => false)) {
            await textarea.scrollIntoViewIfNeeded().catch(() => {});
            await textarea.focus().catch(() => {});
            await textarea.pressSequentially(applicant.coverNote, { delay: 5 });
          }
        }
      } catch (e: any) {}
    }

    // Resume Upload
    if (applicant.resumePath && fs.existsSync(applicant.resumePath)) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible().catch(() => false) || await fileInput.count() > 0) {
          await fileInput.setInputFiles(applicant.resumePath);
          console.log(`[LeverFiller] Attached resume PDF: ${applicant.resumePath}`);
        }
      } catch (e: any) {
        console.warn(`[LeverFiller] Resume upload error:`, e.message);
      }
    }

    await page.waitForTimeout(2000);

    if (!dryRun) {
      console.log(`[LeverFiller] Submitting application live for ${applicant.fullName}...`);
      const submitBtn = page.locator('button[type="submit"], #btn-submit, button:has-text("Submit"), button:has-text("Apply")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
        await submitBtn.hover().catch(() => {});
        await page.waitForTimeout(800);
        await submitBtn.click();
        await page.waitForTimeout(6000);
      }
    } else {
      console.log(`[LeverFiller] Dry run mode - filled form without clicking final submit.`);
    }

    // Verify submission outcome on page post-submit (includes DOM stabilization poll loop)
    const verification = dryRun
      ? { success: true, isConfirmed: true, validationMessages: [] }
      : await verifySubmissionOutcome(page, applyUrl);

    // Capture post-verification outcome screenshot
    const screenshotsDir = path.join(__dirname, '../../../uploads/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const prefix = verification.success ? 'success' : 'failure';
    const screenshotFileName = `${prefix}_lever_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFileName);

    if (verification.success) {
      await page.waitForTimeout(1500); // Allow thank-you UI animations to settle
    }
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    console.log(`[LeverFiller] ${verification.success ? '✅ Success' : '❌ Failure'} verification screenshot saved to: ${screenshotPath}`);

    await browser.close();
    return {
      success: verification.success,
      isConfirmed: verification.isConfirmed,
      failureReason: verification.failureReason,
      validationMessages: verification.validationMessages,
      error: verification.errorDetails,
      screenshotUrl: `/uploads/screenshots/${screenshotFileName}`,
      submittedAt: verification.success ? new Date() : undefined,
    };
  } catch (err: any) {
    console.error('[LeverFiller] Error during application:', err.message);
    await browser.close();
    return {
      success: false,
      isConfirmed: false,
      failureReason: 'UNKNOWN',
      error: err.message,
    };
  }
}
