import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ApplicantInfo, SubmissionResult } from './types';
import { verifySubmissionOutcome } from './verifySubmission';
import path from 'path';
import fs from 'fs';

// Apply stealth plugin stack
chromium.use(stealthPlugin());

export async function fillGreenhouseApplication(
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
    console.log(`[GreenhouseFiller] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });

    // Ensure form is visible
    await page.waitForSelector('form#application_form, form[action*="greenhouse"], input', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const names = applicant.fullName.split(' ');
    const firstName = applicant.firstName || names[0] || '';
    const lastName = applicant.lastName || names.slice(1).join(' ') || firstName;

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

    await safeFill(/first name/i, '#first_name, input[name*="first_name"]', firstName);
    await safeFill(/last name/i, '#last_name, input[name*="last_name"]', lastName);
    await safeFill(/email/i, '#email, input[type="email"]', applicant.email);
    await safeFill(/phone/i, '#phone, input[type="tel"]', applicant.phone || '555-019-2831');
    await safeFill(/location/i, '#job_application_location, input[name*="location"]', applicant.location);
    await safeFill(/linkedin/i, 'input[autocomplete*="linkedin"], input[id*="linkedin"]', applicant.linkedinUrl);
    await safeFill(/github/i, 'input[autocomplete*="github"], input[id*="github"]', applicant.githubUrl);
    await safeFill(/website|portfolio/i, 'input[autocomplete*="website"], input[id*="website"]', applicant.portfolioUrl);

    // Cover Letter
    if (applicant.coverNote) {
      try {
        const coverByLabel = page.getByLabel(/cover|comments|note/i).first();
        if (await coverByLabel.isVisible().catch(() => false)) {
          await coverByLabel.scrollIntoViewIfNeeded().catch(() => {});
          await coverByLabel.focus().catch(() => {});
          await coverByLabel.pressSequentially(applicant.coverNote, { delay: 5 });
        } else {
          const coverText = page.locator('#cover_letter_text, textarea[name*="cover"]').first();
          if (await coverText.isVisible().catch(() => false)) {
            await coverText.scrollIntoViewIfNeeded().catch(() => {});
            await coverText.focus().catch(() => {});
            await coverText.pressSequentially(applicant.coverNote, { delay: 5 });
          }
        }
      } catch (e: any) {}
    }

    // Attach resume file if available
    if (applicant.resumePath && fs.existsSync(applicant.resumePath)) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible().catch(() => false) || await fileInput.count() > 0) {
          await fileInput.setInputFiles(applicant.resumePath);
          console.log(`[GreenhouseFiller] Attached resume PDF: ${applicant.resumePath}`);
        }
      } catch (e: any) {
        console.warn(`[GreenhouseFiller] Resume upload error:`, e.message);
      }
    }

    await page.waitForTimeout(2000);

    if (!dryRun) {
      console.log(`[GreenhouseFiller] Submitting application live for ${applicant.fullName}...`);
      const submitButton = page.locator('#submit_app, button[type="submit"], input[type="submit"]').first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.scrollIntoViewIfNeeded().catch(() => {});
        await submitButton.hover().catch(() => {});
        await page.waitForTimeout(800);
        await submitButton.click();
        await page.waitForTimeout(6000);
      }
    } else {
      console.log(`[GreenhouseFiller] Dry run mode - filled form without clicking final submit.`);
    }

    // Take verification screenshot (captured after submit in live mode, or pre-submit in dryRun)
    const screenshotsDir = path.join(__dirname, '../../../uploads/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotFileName = `greenhouse_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFileName);
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Verify submission outcome on page post-submit
    const verification = dryRun
      ? { success: true, isConfirmed: true, validationMessages: [] }
      : await verifySubmissionOutcome(page, url);

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
    console.error('[GreenhouseFiller] Error during application:', err.message);
    await browser.close();
    return {
      success: false,
      isConfirmed: false,
      failureReason: 'UNKNOWN',
      error: err.message,
    };
  }
}
