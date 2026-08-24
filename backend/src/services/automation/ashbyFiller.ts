import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ApplicantInfo, SubmissionResult } from './types';
import path from 'path';
import fs from 'fs';

// Apply stealth plugin stack
chromium.use(stealthPlugin());

export async function fillAshbyApplication(
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
    const applyUrl = url.includes('/application') ? url : `${url}/application`;
    console.log(`[AshbyFiller] Navigating to ${applyUrl}`);
    
    // Wait for networkidle so Ashby JS SPA loads completely
    await page.goto(applyUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });

    // Explicit wait for SPA container to render inputs
    await page.waitForSelector('input, form, button', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Helper to safely fill inputs with human-like typing simulation
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

    // Fill candidate information
    await safeFill(/preferred name|full name|name/i, '#_systemfield_name, input[name*="name"], input[autocomplete="name"]', applicant.fullName);
    await safeFill(/legal name/i, 'input[name*="legal"], input[placeholder*="if different" i]', applicant.fullName);
    await safeFill(/email/i, '#_systemfield_email, input[type="email"], input[name*="email"]', applicant.email);
    await safeFill(/phone/i, '#_systemfield_phone, input[type="tel"], input[name*="phone"]', applicant.phone || '555-019-2831');
    await safeFill(/linkedin/i, 'input[autocomplete*="linkedin"], input[name*="linkedin"], input[id*="linkedin"]', applicant.linkedinUrl);
    await safeFill(/github/i, 'input[autocomplete*="github"], input[name*="github"], input[id*="github"]', applicant.githubUrl);
    await safeFill(/website|portfolio/i, 'input[name*="website"], input[name*="portfolio"], input[id*="website"]', applicant.portfolioUrl);

    // 1. Location Autocomplete Dropdown
    try {
      const locationInput = page.locator('#_systemfield_location, input[placeholder*="location" i], input[placeholder*="Start typing" i], input[id*="location" i]').first();
      if (await locationInput.isVisible().catch(() => false)) {
        await locationInput.scrollIntoViewIfNeeded().catch(() => {});
        await locationInput.click().catch(() => {});
        await locationInput.pressSequentially(applicant.location || 'San Francisco, CA', { delay: 15 });
        await page.waitForTimeout(600);
        
        // Select from dropdown option or keyboard navigation
        const option = page.locator('[role="option"], div[id*="option"], .ashby-menu-option, div[class*="option"]').first();
        if (await option.isVisible().catch(() => false)) {
          await option.click().catch(() => {});
        } else {
          await page.keyboard.press('ArrowDown').catch(() => {});
          await page.keyboard.press('Enter').catch(() => {});
        }
        console.log(`[AshbyFiller] Filled Location dropdown: ${applicant.location || 'San Francisco, CA'}`);
      }
    } catch (e: any) {
      console.warn(`[AshbyFiller] Location fill warning:`, e.message);
    }

    // 2. Resume File Upload
    if (applicant.resumePath && fs.existsSync(applicant.resumePath)) {
      try {
        const fileInputs = page.locator('#_systemfield_resume, input[type="file"]');
        const fileCount = await fileInputs.count();
        if (fileCount > 0) {
          for (let i = 0; i < fileCount; i++) {
            await fileInputs.nth(i).setInputFiles(applicant.resumePath).catch(() => {});
          }
          console.log(`[AshbyFiller] Attached resume PDF: ${applicant.resumePath}`);
        }
      } catch (e: any) {
        console.warn(`[AshbyFiller] Resume upload warning:`, e.message);
      }
    }

    // 3. Yes/No Radio & Button Questions (Visa Sponsorship, In-Person Work, Work Authorization, Relocation)
    try {
      const optionElements = page.locator('button:has-text("Yes"), button:has-text("No"), label:has-text("Yes"), label:has-text("No")');
      const count = await optionElements.count();
      for (let i = 0; i < count; i++) {
        const el = optionElements.nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;

        const text = (await el.textContent().catch(() => ''))?.trim();
        const parentText = await el.evaluate(node => {
          let current: HTMLElement | null = node.parentElement;
          for (let depth = 0; depth < 4 && current; depth++) {
            if (current.textContent && current.textContent.length > 20) {
              return current.textContent.replace(/\s+/g, ' ');
            }
            current = current.parentElement;
          }
          return '';
        }).catch(() => '');

        if (/sponsorship|visa/i.test(parentText)) {
          const targetChoice = applicant.requiresSponsorship ? 'Yes' : 'No';
          if (text === targetChoice) {
            await el.click().catch(() => {});
            console.log(`[AshbyFiller] Answered Visa Sponsorship -> ${targetChoice}`);
          }
        } else if (/authorized|legally/i.test(parentText)) {
          const targetChoice = applicant.legallyAuthorized !== false ? 'Yes' : 'No';
          if (text === targetChoice) {
            await el.click().catch(() => {});
            console.log(`[AshbyFiller] Answered Work Authorization -> ${targetChoice}`);
          }
        } else if (/relocat/i.test(parentText)) {
          const targetChoice = applicant.openToRelocation !== false ? 'Yes' : 'No';
          if (text === targetChoice) {
            await el.click().catch(() => {});
            console.log(`[AshbyFiller] Answered Relocation -> ${targetChoice}`);
          }
        } else if (/in-person|onsite|hybrid|working|acknowledge/i.test(parentText)) {
          const targetChoice = applicant.openToInPerson !== false ? 'Yes' : 'No';
          if (text === targetChoice) {
            await el.click().catch(() => {});
            console.log(`[AshbyFiller] Answered In-Person / Acknowledgement -> ${targetChoice}`);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[AshbyFiller] Yes/No selection warning:`, e.message);
    }

    // 4. EEO Voluntary Demographic Radio / Dropdown Questions (Gender, Race, Veteran Status, Disability)
    try {
      const eeoRadioLabels = page.locator('label, input[type="radio"], button');
      const count = await eeoRadioLabels.count();

      for (let i = 0; i < count; i++) {
        const item = eeoRadioLabels.nth(i);
        if (!(await item.isVisible().catch(() => false))) continue;

        const text = (await item.textContent().catch(() => ''))?.trim() || '';
        const parentText = await item.evaluate(n => n.closest('fieldset, div[class*="field"], div')?.textContent?.replace(/\s+/g, ' ') || '').catch(() => '');

        if (/gender/i.test(parentText) && applicant.gender) {
          if (text.toLowerCase().includes(applicant.gender.toLowerCase()) || text.includes('Decline')) {
            await item.click().catch(() => {});
            console.log(`[AshbyFiller] Answered Gender demographic -> ${text}`);
          }
        } else if (/race|ethnicity/i.test(parentText) && applicant.race) {
          if (text.toLowerCase().includes(applicant.race.toLowerCase()) || text.includes('Decline')) {
            await item.click().catch(() => {});
            console.log(`[AshbyFiller] Answered Race demographic -> ${text}`);
          }
        } else if (/veteran/i.test(parentText) && applicant.veteranStatus) {
          if (text.toLowerCase().includes(applicant.veteranStatus.toLowerCase()) || text.includes('Decline')) {
            await item.click().catch(() => {});
            console.log(`[AshbyFiller] Answered Veteran demographic -> ${text}`);
          }
        } else if (/disability/i.test(parentText) && applicant.disabilityStatus) {
          if (text.toLowerCase().includes(applicant.disabilityStatus.toLowerCase()) || text.includes('Decline')) {
            await item.click().catch(() => {});
            console.log(`[AshbyFiller] Answered Disability demographic -> ${text}`);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[AshbyFiller] EEO selection warning:`, e.message);
    }

    // 4. Custom Questions & Textareas (e.g. "Why Braintrust?", "Why this role?")
    try {
      const textareas = page.locator('textarea, input[type="text"]:not([name*="name"]):not([name*="email"]):not([name*="phone"]):not([name*="location"]):not([name*="linkedin"]):not([name*="github"]):not([name*="website"])');
      const count = await textareas.count();
      for (let i = 0; i < count; i++) {
        const input = textareas.nth(i);
        if (!(await input.isVisible().catch(() => false))) continue;
        const currentVal = await input.inputValue().catch(() => '');
        if (!currentVal) {
          const label = await input.evaluate(el => el.closest('div, label')?.textContent?.slice(0, 100) || '').catch(() => '');
          let answer = "I am deeply interested in joining your team to contribute to building reliable, high-performance software systems and AI features. My technical background directly matches your requirements.";
          if (applicant.coverNote && /cover|additional|notes/i.test(label)) {
            answer = applicant.coverNote;
          }
          await input.scrollIntoViewIfNeeded().catch(() => {});
          await input.focus().catch(() => {});
          await input.pressSequentially(answer, { delay: 5 });
          console.log(`[AshbyFiller] Filled custom question field (${label.slice(0, 30)}...)`);
        }
      }
    } catch (e: any) {
      console.warn(`[AshbyFiller] Custom questions warning:`, e.message);
    }

    await page.waitForTimeout(2000);

    if (!dryRun) {
      console.log(`[AshbyFiller] Submitting application live for ${applicant.fullName}...`);
      const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Submit Application")').first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
        await submitBtn.hover().catch(() => {});
        await page.waitForTimeout(800);
        await submitBtn.click();
        await page.waitForTimeout(6000);
      }
    } else {
      console.log(`[AshbyFiller] Dry run mode - filled form without clicking final submit.`);
    }

    // Verification screenshot (captured after submit in live mode, or pre-submit in dryRun)
    const screenshotsDir = path.join(__dirname, '../../../uploads/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotFileName = `ashby_${Date.now()}.png`;
    const screenshotPath = path.join(screenshotsDir, screenshotFileName);
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await browser.close();
    return {
      success: true,
      screenshotUrl: `/uploads/screenshots/${screenshotFileName}`,
      submittedAt: new Date(),
    };
  } catch (err: any) {
    console.error('[AshbyFiller] Error during application:', err.message);
    await browser.close();
    return {
      success: false,
      error: err.message,
    };
  }
}
