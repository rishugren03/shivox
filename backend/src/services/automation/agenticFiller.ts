import 'dotenv/config';
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { ApplicantInfo, SubmissionResult } from './types';
import { generateTailoredResume } from '../ai/agents/resumeTailorAgent';
import { extractFormFields } from '../ai/agents/formInspectorAgent';
import { resolveFormQuestions } from '../ai/agents/questionResolverAgent';
import { verifySubmissionOutcome } from './verifySubmission';
import { registerPendingOtpSession } from './otpResolver';
import {
  applyAdvancedStealthOverrides,
  humanType,
  humanMoveAndClick,
  humanScrollAndDwell,
} from './humanBehavior';

chromium.use(stealthPlugin());

export interface AgenticFillOptions {
  url: string;
  applicant: ApplicantInfo;
  jobTitle?: string;
  jobCompany?: string;
  jobDescription?: string;
  dryRun?: boolean;
  applicationId?: string;
}

async function navigateToApplicationForm(page: any, jobTitle: string) {
  const hasInputs = await page.locator('input:not([type="hidden"]), textarea').count().catch(() => 0);
  if (hasInputs >= 3) return;

  console.log(`[AgenticFiller] Form inputs not found on landing page. Searching for direct job application link for "${jobTitle}"...`);

  const selectors = [
    `a:has-text("${jobTitle}")`,
    `button:has-text("${jobTitle}")`,
    'a:has-text("Apply")',
    'button:has-text("Apply")',
    'a:has-text("Apply for this Job")',
    'button:has-text("Apply for this Job")',
    'a[href*="job"]',
    'a[href*="apply"]',
  ];

  for (const sel of selectors) {
    const target = page.locator(sel).first();
    if (await target.isVisible().catch(() => false)) {
      console.log(`[AgenticFiller] Navigating into job application form via: ${sel}`);
      await target.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      const newHasInputs = await page.locator('input:not([type="hidden"]), textarea').count().catch(() => 0);
      if (newHasInputs >= 3) return;
    }
  }
}

async function handleLocationCombobox(page: any, locationQuery: string): Promise<boolean> {
  console.log(`[LocationCombobox] Attempting selection for location query: "${locationQuery}"...`);
  
  const locationLocators = [
    'button:has-text("Start typing")',
    'div[class*="select"]:has-text("Start typing")',
    '#_systemfield_location',
    'input[id*="location" i]',
    'input[name*="location" i]',
    'input[placeholder*="location" i]',
    'input[placeholder*="Start typing" i]',
    'div[role="combobox"]',
    'label:has-text("Country") + div button',
    'label:has-text("residing") + div button',
  ];

  for (const sel of locationLocators) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      try {
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        await loc.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);

        // After clicking trigger, find open input in popover/dropdown/menu or focused input
        const popoverInput = page.locator('input:focus, input[type="search"], input[placeholder*="Search" i], input[placeholder*="Filter" i], div[class*="popover"] input, div[class*="menu"] input, div[role="dialog"] input').first();
        const searchTarget = (await popoverInput.isVisible().catch(() => false)) ? popoverInput : loc;

        const isInput = await searchTarget.evaluate((el: HTMLElement) => el.tagName.toLowerCase() === 'input').catch(() => false);

        const searchQueries = Array.from(new Set([
          'United States',
          locationQuery,
          locationQuery.split(',')[0],
          'Remote',
        ])).filter(Boolean);

        for (const query of searchQueries) {
          if (isInput) {
            await searchTarget.click({ force: true }).catch(() => {});
            await searchTarget.fill('').catch(() => {});
            await page.waitForTimeout(200);
            await searchTarget.pressSequentially(query, { delay: 40 });
            await page.waitForTimeout(600);
          }

          const optionSel = '[role="option"], [class*="option"], [class*="menu-option"], div[class*="ashby-dropdown-item"], li[role="option"]';
          const popoverOption = page.locator(optionSel).first();

          if (await popoverOption.isVisible({ timeout: 1500 }).catch(() => false)) {
            await popoverOption.click({ force: true }).catch(() => {});
            console.log(`[LocationCombobox] Clicked popover option for location query: "${query}"`);
            await page.waitForTimeout(500);
            return true;
          }

          await page.keyboard.press('ArrowDown').catch(() => {});
          await page.waitForTimeout(200);
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForTimeout(200);
          await page.keyboard.press('Tab').catch(() => {});

          const optionAfterKb = page.locator(optionSel).first();
          if (!(await optionAfterKb.isVisible().catch(() => false))) {
            console.log(`[LocationCombobox] Selection completed via keyboard.`);
            return true;
          }
        }
      } catch (e: any) {
        console.warn(`[LocationCombobox] Attempt error on ${sel}:`, e.message);
      }
    }
  }
  return false;
}

async function executePreSubmitSelfCorrection(page: any, applicant: ApplicantInfo) {
  console.log('[SelfCorrectionQA] Running pre-submit DOM self-correction loop...');
  await page.waitForTimeout(1500);

  // 1. Find all visible text/email/url/tel inputs & textareas on the page
  const allInputs = page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
  const count = await allInputs.count();

  for (let i = 0; i < count; i++) {
    const input = allInputs.nth(i);
    if (!(await input.isVisible().catch(() => false))) continue;

    const val = await input.inputValue().catch(() => '');
    if (val && val.trim() !== '') continue; // Skip already filled inputs

    const isReqAttr = (await input.getAttribute('required').catch(() => '')) !== null || (await input.getAttribute('aria-required').catch(() => '')) === 'true';
    const tagName = await input.evaluate((el: HTMLElement) => el.tagName.toLowerCase()).catch(() => '');

    // Extract complete label or parent question text
    let labelText = '';
    const id = await input.getAttribute('id').catch(() => '');
    if (id) {
      const lbl = page.locator(`label[for="${id}"]`).first();
      if (await lbl.isVisible().catch(() => false)) {
        labelText = (await lbl.textContent().catch(() => '')) || '';
      }
    }
    if (!labelText) {
      const parentLabel = input.locator('xpath=ancestor::label').first();
      if (await parentLabel.isVisible().catch(() => false)) {
        labelText = (await parentLabel.textContent().catch(() => '')) || '';
      }
    }
    if (!labelText) {
      const container = input.locator('xpath=ancestor::div[contains(@class, "field") or contains(@class, "question") or contains(@class, "Form") or contains(@class, "ashby")]').first();
      if (await container.isVisible().catch(() => false)) {
        labelText = (await container.textContent().catch(() => '')) || '';
      }
    }
    const cleanLabel = labelText.replace(/\s+/g, ' ').trim();

    let fillText = '';
    if (/github/i.test(cleanLabel)) {
      fillText = applicant.githubUrl || 'https://github.com/rishugren03';
      console.log(`[SelfCorrectionQA] Filled GitHub URL (${cleanLabel.slice(0, 30)}...)`);
    } else if (/linkedin/i.test(cleanLabel)) {
      fillText = applicant.linkedinUrl || 'https://linkedin.com/in/rishu-kumar';
      console.log(`[SelfCorrectionQA] Filled LinkedIn URL (${cleanLabel.slice(0, 30)}...)`);
    } else if (/^name\*?$|full name|preferred name|first and last/i.test(cleanLabel)) {
      fillText = applicant.fullName;
      console.log(`[SelfCorrectionQA] Filled Full Name (${cleanLabel.slice(0, 30)}...)`);
    } else if (/email/i.test(cleanLabel)) {
      fillText = applicant.email;
      console.log(`[SelfCorrectionQA] Filled Email (${cleanLabel.slice(0, 30)}...)`);
    } else if (/phone/i.test(cleanLabel)) {
      fillText = applicant.phone || '555-019-2831';
      console.log(`[SelfCorrectionQA] Filled Phone (${cleanLabel.slice(0, 30)}...)`);
    } else if (/website|portfolio/i.test(cleanLabel)) {
      fillText = applicant.portfolioUrl || 'https://github.com/rishugren03';
      console.log(`[SelfCorrectionQA] Filled Portfolio (${cleanLabel.slice(0, 30)}...)`);
    } else if (/if other|please specify|how did you hear/i.test(cleanLabel)) {
      fillText = 'Job Board / LinkedIn';
      console.log(`[SelfCorrectionQA] Filled conditional text field (${cleanLabel.slice(0, 30)}...): "Job Board / LinkedIn"`);
    } else if (cleanLabel.includes('*') || /required/i.test(cleanLabel) || isReqAttr || tagName === 'textarea') {
      if (/city|state|location|address|country|residing/i.test(cleanLabel)) {
        fillText = applicant.location || 'San Francisco, CA';
      } else {
        fillText = applicant.coverNote || 'I am eager to bring my expertise in software development and AI engineering to this role.';
      }
      console.log(`[SelfCorrectionQA] Filled empty required field (${cleanLabel.slice(0, 30)}...)`);
    }

    if (fillText) {
      await input.click({ force: true }).catch(() => {});
      await input.fill('').catch(() => {});
      await input.pressSequentially(fillText, { delay: 10 }).catch(async () => {
        await input.fill(fillText).catch(() => {});
      });
      await input.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }).catch(() => {});
    }
  }

  // 2. Re-check Location Combobox if empty
  await handleLocationCombobox(page, applicant.location || 'San Francisco, CA');

  // 4. Agreement Checkboxes
  const unselectedCheckboxes = page.locator('input[type="checkbox"]:not(:checked)');
  const cbCount = await unselectedCheckboxes.count();
  for (let i = 0; i < cbCount; i++) {
    const cb = unselectedCheckboxes.nth(i);
    if (await cb.isVisible().catch(() => false)) {
      const isReq = (await cb.getAttribute('required')) !== null || (await cb.getAttribute('aria-required')) === 'true';
      const containerText = (await cb.locator('xpath=ancestor::label | ancestor::div').first().textContent().catch(() => '')) || '';
      if (isReq || /agree|acknowledge|terms|arbitration|consent|policy|privacy|\*/i.test(containerText)) {
        await cb.click({ force: true }).catch(() => {});
        console.log(`[SelfCorrectionQA] Checked required agreement checkbox (${containerText.slice(0, 30)}...)`);
      }
    }
  }

  // 5. Resume Attachment QA
  if (applicant.resumePath && fs.existsSync(applicant.resumePath)) {
    try {
      const fileInputs = page.locator('input[type="file"]');
      const fileCount = await fileInputs.count();
      if (fileCount > 0) {
        for (let i = 0; i < fileCount; i++) {
          await fileInputs.nth(i).setInputFiles(applicant.resumePath).catch(() => {});
        }
        console.log(`[SelfCorrectionQA] Verified resume PDF attached`);
      }
    } catch (e: any) {}
  }
}

export async function handlePostSubmitValidationErrors(
  page: any,
  validationMessages: string[],
  applicant: ApplicantInfo
): Promise<number> {
  console.log('[PostSubmitSelfCorrection] Inspecting validation messages to auto-fix missing fields on DOM...');
  let fixedCount = 0;

  // Extract key field targets from validation messages
  const targetHints: string[] = [];
  for (const msg of validationMessages) {
    const match = msg.match(/(?:required field|missing entry for|for field|entry for):\s*([^;\n]+)/i);
    if (match && match[1]) {
      targetHints.push(match[1].trim());
    } else if (msg.length > 5 && msg.length < 120) {
      // Clean leading error prefix if present
      const cleanMsg = msg.replace(/^your form needs corrections|^we couldn't submit your application/i, '').trim();
      if (cleanMsg) targetHints.push(cleanMsg);
    }
  }

  console.log(`[PostSubmitSelfCorrection] Identified target error hints:`, targetHints);

  const inputs = page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    if (!(await input.isVisible().catch(() => false))) continue;

    const val = await input.inputValue().catch(() => '');
    const isInvalidAttr = (await input.getAttribute('aria-invalid').catch(() => '')) === 'true';
    const isRequiredAttr = (await input.getAttribute('required').catch(() => '')) !== null || (await input.getAttribute('aria-required').catch(() => '')) === 'true';
    const tagName = await input.evaluate((el: HTMLElement) => el.tagName.toLowerCase()).catch(() => '');

    let labelText = '';
    const id = await input.getAttribute('id').catch(() => '');
    if (id) {
      const lbl = page.locator(`label[for="${id}"]`).first();
      if (await lbl.isVisible().catch(() => false)) {
        labelText = (await lbl.textContent().catch(() => '')) || '';
      }
    }
    if (!labelText) {
      const container = input.locator('xpath=ancestor::div[contains(@class, "field") or contains(@class, "question") or contains(@class, "Form") or contains(@class, "ashby")]').first();
      if (await container.isVisible().catch(() => false)) {
        labelText = (await container.textContent().catch(() => '')) || '';
      }
    }
    const cleanLabel = labelText.replace(/\s+/g, ' ').trim();

    // Determine if input matches any target hint or is visibly invalid/empty
    const matchesHint = targetHints.some(hint => {
      const cleanHint = hint.replace(/^(missing entry for required field:|\*|\s)+/i, '').trim().toLowerCase();
      if (!cleanHint) return false;
      const cleanLabelLower = cleanLabel.toLowerCase();
      return cleanLabelLower.includes(cleanHint) || cleanHint.includes(cleanLabelLower);
    });

    const needsCorrection = (!val || val.trim() === '' || isInvalidAttr) && (matchesHint || isRequiredAttr || isInvalidAttr || tagName === 'textarea');

    if (needsCorrection) {
      let contentToFill = applicant.coverNote || 'I am deeply interested in this role and excited to bring my technical experience to your engineering team.';

      if (/github/i.test(cleanLabel)) contentToFill = applicant.githubUrl || 'https://github.com/rishugren03';
      else if (/linkedin/i.test(cleanLabel)) contentToFill = applicant.linkedinUrl || 'https://linkedin.com/in/rishu-kumar';
      else if (/phone/i.test(cleanLabel)) contentToFill = applicant.phone || '555-019-2831';
      else if (/email/i.test(cleanLabel)) contentToFill = applicant.email;
      else if (/^name\*?$|full name|preferred name/i.test(cleanLabel)) contentToFill = applicant.fullName;
      else if (/city|location|address|country/i.test(cleanLabel)) contentToFill = applicant.location || 'San Francisco, CA';

      await input.scrollIntoViewIfNeeded().catch(() => {});
      await input.click({ force: true }).catch(() => {});
      await input.focus().catch(() => {});
      await input.fill('').catch(() => {});
      await input.pressSequentially(contentToFill, { delay: 10 }).catch(async () => {
        await input.fill(contentToFill).catch(() => {});
      });

      await input.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }).catch(() => {});

      console.log(`[PostSubmitSelfCorrection] ✅ Fixed missing/invalid field (${cleanLabel.slice(0, 40)}...) -> filled "${contentToFill.slice(0, 35)}..."`);
      fixedCount++;
    }
  }

  return fixedCount;
}


export async function fillApplicationAgentically(options: AgenticFillOptions): Promise<SubmissionResult> {
  const { url, applicant, dryRun = false } = options;
  const jobTitle = options.jobTitle || 'AI Engineering Role';
  const jobCompany = options.jobCompany || 'Target Tech Company';
  const jobDescription = options.jobDescription || 'Building state-of-the-art AI applications, agentic workflows, and high-performance software systems.';

  console.log(`[AgenticFiller] Starting multi-agent workflow for ${jobCompany} (${jobTitle}) at ${url}`);

  // Step 1: Resume Tailor Agent -> Generate customized ATS PDF Resume
  let tailoredResumePath = applicant.resumePath;
  let tailoredSummary = '';
  let tailoredBullets: string[] = [];

  try {
    const tailored = await generateTailoredResume({
      applicant,
      jobTitle,
      jobCompany,
      jobDescription,
    });
    tailoredResumePath = tailored.pdfPath;
    tailoredSummary = tailored.tailoredSummary;
    tailoredBullets = tailored.tailoredBullets;
  } catch (err: any) {
    console.warn(`[AgenticFiller] Resume tailoring notice:`, err.message);
  }

  // Update applicant resumePath with tailored PDF
  const updatedApplicant: ApplicantInfo = {
    ...applicant,
    resumePath: tailoredResumePath || applicant.resumePath,
  };

  // Step 2: Launch stealth browser
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
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  });

  await applyAdvancedStealthOverrides(context);

  const page = await context.newPage();

  try {
    const applyUrl = url;
    console.log(`[AgenticFiller] Navigating to ${applyUrl}`);
    
    await page.goto(applyUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    });

    await page.waitForTimeout(2000);

    // If on job overview page, click Application tab or Apply button to reveal inputs
    const applyBtnOrTab = page.locator('a:has-text("Application"), button:has-text("Application"), a:has-text("Apply for this Job"), button:has-text("Apply for this Job")').first();
    if (await applyBtnOrTab.isVisible().catch(() => false)) {
      console.log(`[AgenticFiller] Clicking Application tab / Apply button...`);
      await applyBtnOrTab.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Ensure we are on the actual application form (handling job index redirects)
    await navigateToApplicationForm(page, jobTitle);

    await page.waitForSelector('#_systemfield_name, input, textarea, select, form', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Step 3: Form Inspector Agent -> Extract dynamic form layout schema
    const extractedFields = await extractFormFields(page);

    // Step 4: Question Resolver Agent -> Generate action plan via LLM
    const actionPlan = await resolveFormQuestions({
      fields: extractedFields,
      applicant: updatedApplicant,
      jobTitle,
      jobCompany,
      jobDescription,
      tailoredSummary,
      tailoredBullets,
    });

    // Step 5: Form Executor Agent -> Execute action plan in Playwright
    console.log(`[AgenticFiller] Executing ${actionPlan.length} field actions...`);

    for (const action of actionPlan) {
      if (action.actionType === 'skip') continue;

      try {
        if (action.actionType === 'autocomplete') {
          await handleLocationCombobox(page, action.valueToFill || updatedApplicant.location || 'San Francisco, CA');
        } else if (action.actionType === 'click_radio') {
          // Radio buttons or option buttons
          const radioBtn = page.locator(`button:has-text("${action.valueToFill}"), label:has-text("${action.valueToFill}"), input[value="${action.valueToFill}"]`).first();
          if (await radioBtn.isVisible().catch(() => false)) {
            await radioBtn.scrollIntoViewIfNeeded().catch(() => {});
            await radioBtn.click().catch(() => {});
            console.log(`[AgenticFiller] Selected Radio/Option (${action.label}) -> ${action.valueToFill}`);
          } else {
            // Search inside closest parent container
            const targetContainer = page.locator(`fieldset:has-text("${action.label.slice(0, 20)}"), div:has-text("${action.label.slice(0, 20)}")`).first();
            if (await targetContainer.isVisible().catch(() => false)) {
              const opt = targetContainer.locator(`label:has-text("${action.valueToFill}"), button:has-text("${action.valueToFill}")`).first();
              if (await opt.isVisible().catch(() => false)) {
                await opt.click().catch(() => {});
                console.log(`[AgenticFiller] Selected Radio inside container (${action.label}) -> ${action.valueToFill}`);
              }
            }
          }
        } else if (action.actionType === 'upload_file') {
          // Resume upload
          const fileInputs = page.locator('input[type="file"]');
          const count = await fileInputs.count();
          if (count > 0 && action.valueToFill && fs.existsSync(action.valueToFill)) {
            for (let i = 0; i < count; i++) {
              await fileInputs.nth(i).setInputFiles(action.valueToFill).catch(() => {});
            }
            console.log(`[AgenticFiller] Uploaded Tailored Resume PDF: ${action.valueToFill}`);
          }
        } else if (action.actionType === 'type') {
          // Standard input or textarea
          const targetEl = page.locator(action.selector).first();
          if (await targetEl.isVisible().catch(() => false)) {
            await targetEl.scrollIntoViewIfNeeded().catch(() => {});
            await targetEl.click({ force: true }).catch(() => {});
            await targetEl.fill('').catch(() => {});
            await targetEl.pressSequentially(action.valueToFill || '', { delay: 10 }).catch(async () => {
              await targetEl.fill(action.valueToFill || '').catch(() => {});
            });
            await targetEl.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
            }).catch(() => {});
            const safeLabel = action.label || '';
            console.log(`[AgenticFiller] Filled field (${safeLabel.slice(0, 30)}...): "${(action.valueToFill || '').slice(0, 40)}..."`);
          } else {
            // Label-based fallback
            const safeLabel = action.label || '';
            const byLabel = page.getByLabel(new RegExp(safeLabel.slice(0, 20), 'i')).first();
            if (await byLabel.isVisible().catch(() => false)) {
              await byLabel.scrollIntoViewIfNeeded().catch(() => {});
              await byLabel.click({ force: true }).catch(() => {});
              await byLabel.fill('').catch(() => {});
              await byLabel.pressSequentially(action.valueToFill || '', { delay: 10 }).catch(async () => {
                await byLabel.fill(action.valueToFill || '').catch(() => {});
              });
              await byLabel.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => {
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
              }).catch(() => {});
              console.log(`[AgenticFiller] Filled via label fallback (${safeLabel.slice(0, 30)}...)`);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[AgenticFiller] Action error on "${action.label || 'unknown'}":`, err.message);
      }
    }

    // Step 6: Pre-Submit QA Self-Correction Pass
    await executePreSubmitSelfCorrection(page, updatedApplicant);

    // Step 7: Simulate natural human scrolling & reading dwell time before submitting
    await humanScrollAndDwell(page, 4000, 7000);

    // Step 8: Submission & Outcome Verification with Post-Submit Retry Loop
    const screenshotsDir = path.join(__dirname, '../../../uploads/screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const maxPostSubmitRetries = 2;
    let verification: any = { success: false, isConfirmed: false, validationMessages: [] };
    let finalScreenshotPath = '';
    let finalScreenshotFileName = '';

    for (let attempt = 0; attempt <= maxPostSubmitRetries; attempt++) {
      if (!dryRun) {
        if (attempt > 0) {
          console.log(`[AgenticFiller] 🔄 Retrying submission post-correction (Attempt ${attempt + 1}/${maxPostSubmitRetries + 1})...`);
        } else {
          console.log(`[AgenticFiller] Submitting application live for ${updatedApplicant.fullName}...`);
        }

        const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Submit Application"), input[type="submit"]').first();
        if (await submitBtn.isVisible().catch(() => false)) {
          await humanMoveAndClick(page, submitBtn);
          await page.waitForTimeout(6000);
        }
      } else {
        console.log(`[AgenticFiller] Dry run mode - completed form filling without clicking final submit button.`);
      }

      // Capture post-submission verification screenshot
      finalScreenshotFileName = `agentic_${Date.now()}.png`;
      finalScreenshotPath = path.join(screenshotsDir, finalScreenshotFileName);

      await page.waitForTimeout(1000);
      await page.screenshot({ path: finalScreenshotPath, fullPage: true });
      console.log(`[AgenticFiller] Verification screenshot saved to: ${finalScreenshotPath}`);

      // Verify submission outcome on page post-submit
      verification = dryRun
        ? { success: true, isConfirmed: true, validationMessages: [] }
        : await verifySubmissionOutcome(page, url);

      if (verification.requiresOtp) {
        const targetAppId = options.applicationId || 'current_application';
        console.log(`[AgenticFiller] 🔑 OTP prompt detected on page. Holding browser session open for application ${targetAppId}...`);
        registerPendingOtpSession(targetAppId, page, browser);
        return {
          success: false,
          isConfirmed: false,
          requiresOtp: true,
          otpEmail: verification.otpEmail,
          screenshotUrl: `/uploads/screenshots/${finalScreenshotFileName}`,
          error: 'Security OTP verification code required.',
        };
      }

      if (verification.success || dryRun) {
        break; // Submission successful
      }

      if (
        attempt < maxPostSubmitRetries &&
        (verification.failureReason === 'VALIDATION_ERRORS' || verification.failureReason === 'FORM_NOT_SUBMITTED')
      ) {
        console.warn(
          `[AgenticFiller] ⚠️ Submission verification detected errors (Attempt ${attempt + 1}/${maxPostSubmitRetries + 1}): ${verification.validationMessages.join('; ')}`
        );
        console.log(`[AgenticFiller] 🛠️ Initiating post-submit DOM self-correction and retry...`);

        const fixedCount = await handlePostSubmitValidationErrors(
          page,
          verification.validationMessages,
          updatedApplicant
        );

        // Run pre-submit self-correction pass again as additional safeguard
        await executePreSubmitSelfCorrection(page, updatedApplicant);

        await page.waitForTimeout(1500);
      } else {
        break; // Stop retrying if max retries exceeded or unrecoverable error
      }
    }

    await browser.close();

    return {
      success: verification.success,
      isConfirmed: verification.isConfirmed,
      requiresOtp: verification.requiresOtp,
      otpEmail: verification.otpEmail,
      failureReason: verification.failureReason,
      validationMessages: verification.validationMessages,
      error: verification.errorDetails,
      screenshotUrl: `/uploads/screenshots/${finalScreenshotFileName}`,
      submittedAt: verification.success ? new Date() : undefined,
    };
  } catch (err: any) {
    console.error('[AgenticFiller] Application workflow error:', err.message);
    await browser.close();
    return {
      success: false,
      isConfirmed: false,
      failureReason: 'UNKNOWN',
      error: err.message,
    };
  }
}

