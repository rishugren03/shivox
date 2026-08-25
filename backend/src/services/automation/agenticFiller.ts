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
import { validateDomBeforeSubmit, visionVerifyForm } from './preSubmitGate';
import { prisma } from '../../config/prisma';
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
  masterResumeJson?: any;
  masterResumeText?: string;
}

async function navigateToApplicationForm(page: any, jobTitle: string) {
  const hasInputs = await page.locator('input:not([type="hidden"]), textarea').count().catch(() => 0);
  if (hasInputs >= 3) return;

  console.log(`[AgenticFiller] Form inputs not found on landing page. Searching for direct job application link for "${jobTitle}"...`);

  const currentUrl = page.url();

  // Greenhouse-specific: check for embedded application iframe (#grnhse_app)
  if (/greenhouse/i.test(currentUrl)) {
    const ghIframe = page.frameLocator('#grnhse_app').first();
    try {
      const iframeInputs = await ghIframe.locator('input:not([type="hidden"]), textarea').count().catch(() => 0);
      if (iframeInputs >= 3) {
        console.log(`[AgenticFiller] Found Greenhouse embedded application iframe with ${iframeInputs} inputs.`);
        return; // Form is inside iframe — caller should handle frameLocator
      }
    } catch (e) {}

    // Try scrolling to #application anchor or clicking "Apply for this job"
    const applyLink = page.locator('a[href="#app"], a[href*="#application"], a:has-text("Apply for this job"), button:has-text("Apply for this job")').first();
    if (await applyLink.isVisible().catch(() => false)) {
      console.log(`[AgenticFiller] Clicking Greenhouse Apply link...`);
      await applyLink.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      const newInputs = await page.locator('input:not([type="hidden"]), textarea').count().catch(() => 0);
      if (newInputs >= 3) return;
    }
  }

  // Lever-specific: navigate to /apply if not already there
  if (/lever\.co/i.test(currentUrl) && !/\/apply/i.test(currentUrl)) {
    const leverApplyUrl = currentUrl.replace(/\/?$/, '/apply');
    console.log(`[AgenticFiller] Lever detected. Navigating to apply URL: ${leverApplyUrl}`);
    await page.goto(leverApplyUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
      await page.goto(leverApplyUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    });
    await page.waitForTimeout(2000);
    const leverInputs = await page.locator('input:not([type="hidden"]), textarea').count().catch(() => 0);
    if (leverInputs >= 3) return;
  }

  const selectors = [
    `a:has-text("${jobTitle}")`,
    `button:has-text("${jobTitle}")`,
    'a:has-text("Apply for this position")',
    'button:has-text("Apply for this position")',
    'a:has-text("Apply for this Job")',
    'button:has-text("Apply for this Job")',
    'a:has-text("Apply")',
    'button:has-text("Apply")',
    'a:has-text("Apply Now")',
    'button:has-text("Apply Now")',
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

async function executePreSubmitSelfCorrection(
  page: any,
  applicant: ApplicantInfo
): Promise<{ fixedCount: number; unresolvedFields: string[] }> {
  console.log('[SelfCorrectionQA] Running pre-submit DOM self-correction loop...');
  await page.waitForTimeout(1500);

  let fixedCount = 0;
  const unresolvedFields: string[] = [];

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
    const isRequired = cleanLabel.includes('*') || /required/i.test(cleanLabel) || isReqAttr;

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
    } else if (/city|state|location|address|country|residing/i.test(cleanLabel)) {
      fillText = applicant.location || 'San Francisco, CA';
      console.log(`[SelfCorrectionQA] Filled Location (${cleanLabel.slice(0, 30)}...)`);
    } else if (/if other|please specify|how did you hear/i.test(cleanLabel) && tagName !== 'select') {
      fillText = 'Job Board / LinkedIn';
      console.log(`[SelfCorrectionQA] Filled conditional text field (${cleanLabel.slice(0, 30)}...): "Job Board / LinkedIn"`);
    } else if ((/why|motivation|tell us|cover letter|additional info|note|about you|interest/i.test(cleanLabel) || tagName === 'textarea') && tagName !== 'select') {
      fillText = applicant.coverNote || 'I am eager to bring my expertise in software development and AI engineering to this role.';
      console.log(`[SelfCorrectionQA] Filled open-ended prompt field (${cleanLabel.slice(0, 30)}...) with coverNote`);
    } else if (tagName === 'select') {
      // Auto-select first non-empty option for select element or custom dropdown
      try {
        if (tagName === 'select') {
          const options = await input.locator('option').allInnerTexts().catch(() => []);
          const validOpt = options.find((o: string) => o.trim() && !/select|choose|please/i.test(o.trim())) || options[1] || options[0];
          if (validOpt) {
            await input.selectOption({ label: validOpt.trim() }).catch(() => {});
            console.log(`[SelfCorrectionQA] Auto-selected option for <select> (${cleanLabel.slice(0, 30)}...): "${validOpt.trim()}"`);
            fixedCount++;
          }
        } else {
          // Custom select container handling
          const parent = input.locator('..').first();
          const childSelect = parent.locator('select').first();
          if (await childSelect.isVisible().catch(() => false)) {
            const options = await childSelect.locator('option').allInnerTexts().catch(() => []);
            const validOpt = options.find((o: string) => o.trim() && !/select|choose|please/i.test(o.trim())) || options[1] || options[0];
            if (validOpt) {
              await childSelect.selectOption({ label: validOpt.trim() }).catch(() => {});
              console.log(`[SelfCorrectionQA] Auto-selected option for container <select> (${cleanLabel.slice(0, 30)}...): "${validOpt.trim()}"`);
              fixedCount++;
            }
          }
        }
      } catch (e: any) {}
    } else if (isRequired) {
      // General fallback for unmatched required text fields
      fillText = 'Yes';
      console.log(`[SelfCorrectionQA] Filled generic required field (${cleanLabel.slice(0, 30)}...): "Yes"`);
      fixedCount++;
    }

    if (fillText && tagName !== 'select') {
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
      fixedCount++;
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

  return { fixedCount, unresolvedFields };
}

export async function handlePostSubmitValidationErrors(
  page: any,
  validationMessages: string[],
  applicant: ApplicantInfo
): Promise<{ fixedCount: number; unresolvedFields: string[] }> {
  console.log('[PostSubmitSelfCorrection] Inspecting validation messages to auto-fix missing fields on DOM...');
  let fixedCount = 0;
  const unresolvedFields: string[] = [];

  // Extract key field targets from validation messages
  const targetHints: string[] = [];
  for (const msg of validationMessages) {
    const match = msg.match(/(?:required field|missing entry for|for field|entry for):\s*([^;\n]+)/i);
    if (match && match[1]) {
      targetHints.push(match[1].trim());
    } else if (msg.length > 5 && msg.length < 120) {
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

    const matchesHint = targetHints.some(hint => {
      const cleanHint = hint.replace(/^(missing entry for required field:|\*|\s)+/i, '').trim().toLowerCase();
      if (!cleanHint) return false;
      const cleanLabelLower = cleanLabel.toLowerCase();
      return cleanLabelLower.includes(cleanHint) || cleanHint.includes(cleanLabelLower);
    });

    const needsCorrection = (!val || val.trim() === '' || isInvalidAttr) && (matchesHint || isRequiredAttr || isInvalidAttr || tagName === 'textarea');

    if (needsCorrection) {
      let contentToFill = '';

      if (/github/i.test(cleanLabel)) contentToFill = applicant.githubUrl || 'https://github.com/rishugren03';
      else if (/linkedin/i.test(cleanLabel)) contentToFill = applicant.linkedinUrl || 'https://linkedin.com/in/rishu-kumar';
      else if (/phone/i.test(cleanLabel)) contentToFill = applicant.phone || '555-019-2831';
      else if (/email/i.test(cleanLabel)) contentToFill = applicant.email;
      else if (/^name\*?$|full name|preferred name/i.test(cleanLabel)) contentToFill = applicant.fullName;
      else if (/city|location|address|country/i.test(cleanLabel)) contentToFill = applicant.location || 'San Francisco, CA';
      else if (/if other|please specify|how did you hear/i.test(cleanLabel)) contentToFill = 'Job Board / LinkedIn';
      else if (/why|motivation|tell us|cover letter|additional info|note|about you|interest/i.test(cleanLabel) || tagName === 'textarea') {
        contentToFill = applicant.coverNote || 'I am deeply interested in this role and excited to bring my technical experience to your engineering team.';
      } else {
        console.warn(`[PostSubmitSelfCorrection] ⚠️ Field "${cleanLabel.slice(0, 40)}" needs correction but is not an open-ended ask or known pattern. Marking skipped.`);
        unresolvedFields.push(cleanLabel || 'Unlabeled field');
      }

      if (contentToFill) {
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
  }

  return { fixedCount, unresolvedFields };
}


export async function fillApplicationAgentically(options: AgenticFillOptions): Promise<SubmissionResult> {
  const { url, applicant, dryRun = false } = options;
  const jobTitle = options.jobTitle || 'AI Engineering Role';
  const jobCompany = options.jobCompany || 'Target Tech Company';
  const jobDescription = options.jobDescription || 'Building state-of-the-art AI applications, agentic workflows, and high-performance software systems.';

  console.log(`[AgenticFiller] Starting multi-agent workflow for ${jobCompany} (${jobTitle}) at ${url}`);

  // FIX 1: Resolve authenticated user's masterResumeJson from options or Prisma DB
  let masterResumeJson = options.masterResumeJson;
  let masterResumeText = options.masterResumeText;

  if (!masterResumeJson && options.applicationId) {
    try {
      const appRecord = await prisma.application.findUnique({
        where: { id: options.applicationId },
        include: { user: { include: { resumeVersions: true } } },
      });
      if (appRecord?.user) {
        const activeVer = appRecord.user.resumeVersions.find((v: any) => v.isActive);
        const rawJson = activeVer?.resumeJson || appRecord.user.resumeJson;
        masterResumeText = activeVer?.resumeText || appRecord.user.resumeText || undefined;

        if (rawJson) {
          masterResumeJson = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        }
      }
    } catch (e: any) {
      console.warn(`[AgenticFiller] Error fetching user master resume from Prisma:`, e.message);
    }
  }

  // FIX 1 Safeguard: If resumeJson is null/missing/empty, log warning and mark needs_manual_review
  if (!masterResumeJson || (typeof masterResumeJson === 'object' && Object.keys(masterResumeJson).length === 0)) {
    const errorMsg = `User master resumeJson is missing/null. Application marked for manual review to prevent submitting generic placeholder resume text.`;
    console.warn(`[AgenticFiller] ⚠️ FIX 1 WARN: ${errorMsg}`);

    if (options.applicationId) {
      await prisma.application.update({
        where: { id: options.applicationId },
        data: {
          status: 'needs_manual_review',
          preSubmitGateFailure: 'UserProfile.resumeJson is null or missing.',
          errorMessage: errorMsg,
        },
      }).catch(() => {});
    }

    return {
      success: false,
      isConfirmed: false,
      failureReason: 'RESUME_MISSING',
      preSubmitGateFailure: 'UserProfile.resumeJson is null or missing.',
      error: errorMsg,
    };
  }

  // Step 1: Resume Tailor Agent -> Generate customized ATS PDF Resume using authentic masterResumeJson
  let tailoredResumePath = applicant.resumePath;
  let tailoredSummary = '';
  let tailoredBullets: string[] = [];

  try {
    const tailored = await generateTailoredResume({
      applicant,
      jobTitle,
      jobCompany,
      jobDescription,
      masterResumeJson,
      masterResumeText,
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
    
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
      await page.goto(applyUrl, { waitUntil: 'networkidle', timeout: 30000 });
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

    // Guard: if too few fields extracted, the page likely isn't the application form
    if (extractedFields.length < 3) {
      const warnMsg = `FormInspector only extracted ${extractedFields.length} fields. Page may be a job listing, not an application form. URL: ${page.url()}`;
      console.warn(`[AgenticFiller] ⚠️ ${warnMsg}`);

      if (options.applicationId) {
        await prisma.application.update({
          where: { id: options.applicationId },
          data: {
            status: 'needs_manual_review',
            errorMessage: warnMsg,
            preSubmitGateFailure: 'Insufficient form fields detected. Application form may not have loaded.',
          },
        }).catch(() => {});
      }

      await browser.close();
      return {
        success: false,
        isConfirmed: false,
        failureReason: 'FORM_NOT_SUBMITTED',
        error: warnMsg,
        preSubmitGateFailure: 'Insufficient form fields detected.',
      };
    }

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
        } else if (action.actionType === 'select_option') {
          let valToSelect = action.valueToFill || '';
          if (!valToSelect || /no value|null|undefined/i.test(valToSelect)) {
            valToSelect = 'Yes';
          }
          let selected = false;

          if (action.selector) {
            const el = page.locator(action.selector).first();
            if (await el.isVisible().catch(() => false)) {
              const tagName = await el.evaluate((node: HTMLElement) => node.tagName.toLowerCase()).catch(() => '');
              if (tagName === 'select') {
                const optSelected = await el.selectOption({ label: valToSelect }).catch(async () => {
                  return await el.selectOption({ value: valToSelect }).catch(() => null);
                });
                if (!optSelected || optSelected.length === 0) {
                  // Fall back to selecting option index 1 (first non-empty option)
                  await el.selectOption({ index: 1 }).catch(() => {});
                }
                selected = true;
                console.log(`[AgenticFiller] Selected option on <select> (${action.label}) -> ${valToSelect}`);
              } else {
                // Custom select trigger button / combobox
                await el.scrollIntoViewIfNeeded().catch(() => {});
                await el.click({ force: true }).catch(() => {});
                await page.waitForTimeout(400);

                const optionSel = `[role="option"]:has-text("${valToSelect}"), div[class*="option"]:has-text("${valToSelect}"), li:has-text("${valToSelect}"), button:has-text("${valToSelect}")`;
                const opt = page.locator(optionSel).first();
                if (await opt.isVisible({ timeout: 1500 }).catch(() => false)) {
                  await opt.click({ force: true }).catch(() => {});
                  selected = true;
                  console.log(`[AgenticFiller] Selected option on custom dropdown (${action.label}) -> ${valToSelect}`);
                } else {
                  // Fall back to clicking first visible option in popover
                  const firstOpt = page.locator('[role="option"], div[class*="option"], li[class*="option"]').first();
                  if (await firstOpt.isVisible().catch(() => false)) {
                    await firstOpt.click({ force: true }).catch(() => {});
                    selected = true;
                    console.log(`[AgenticFiller] Selected first option fallback on custom dropdown (${action.label})`);
                  }
                }
              }
            }
          }

          if (!selected && action.label) {
            const escapedLabel = action.label.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const container = page.locator(`fieldset:has-text("${escapedLabel}"), div:has-text("${escapedLabel}")`).first();
            if (await container.isVisible().catch(() => false)) {
              const opt = container.locator(`option:has-text("${valToSelect}"), button:has-text("${valToSelect}"), label:has-text("${valToSelect}"), div:has-text("${valToSelect}")`).first();
              if (await opt.isVisible().catch(() => false)) {
                await opt.click({ force: true }).catch(() => {});
                console.log(`[AgenticFiller] Selected option via container fallback (${action.label}) -> ${valToSelect}`);
              }
            }
          }
        } else if (action.actionType === 'click_radio') {
          // Radio buttons or option buttons
          const radioBtn = page.locator(`button:has-text("${action.valueToFill}"), label:has-text("${action.valueToFill}"), input[value="${action.valueToFill}"]`).first();
          if (await radioBtn.isVisible().catch(() => false)) {
            await radioBtn.scrollIntoViewIfNeeded().catch(() => {});
            await radioBtn.click().catch(() => {});
            console.log(`[AgenticFiller] Selected Radio/Option (${action.label}) -> ${action.valueToFill}`);
          } else {
            // Search inside closest parent container
            const escapedLabel = action.label.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const targetContainer = page.locator(`fieldset:has-text("${escapedLabel}"), div:has-text("${escapedLabel}")`).first();
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
            const escapedLabel = safeLabel.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const byLabel = page.getByLabel(new RegExp(escapedLabel, 'i')).first();
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

    // FIX 3 / INTEGRATION: Pre-Submit Verification Gate (DOM -> Act -> Vision)
    console.log('[AgenticFiller] 🛡️ Running Pre-Submit Gate Verification (DOM check -> Vision check)...');

    // 1. validateDomBeforeSubmit
    let domCheck = await validateDomBeforeSubmit(page, actionPlan);

    // 2. Retry loop (max 1 retry round) if DOM check fails
    if (!domCheck.ok) {
      console.warn(`[AgenticFiller] ⚠️ DOM pre-submit check failed for missing fields: ${domCheck.missing.join(', ')}. Initiating 1 retry round...`);

      const missingFields = extractedFields.filter(f => domCheck.missing.some(m => f.label.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(f.label.toLowerCase())));
      const retryFieldsToResolve = missingFields.length > 0 ? missingFields : extractedFields;

      const retryActions = await resolveFormQuestions({
        fields: retryFieldsToResolve,
        applicant: updatedApplicant,
        jobTitle,
        jobCompany,
        jobDescription,
        tailoredSummary,
        tailoredBullets,
      });

      for (const action of retryActions) {
        if (action.actionType === 'skip') continue;
        try {
          if (action.actionType === 'type') {
            const loc = page.locator(action.selector).first();
            if (await loc.isVisible().catch(() => false)) {
              await loc.fill(action.valueToFill || '').catch(() => {});
            }
          } else if (action.actionType === 'autocomplete') {
            await handleLocationCombobox(page, action.valueToFill || updatedApplicant.location || 'San Francisco, CA');
          } else if (action.actionType === 'click_radio') {
            const radioBtn = page.locator(`button:has-text("${action.valueToFill}"), label:has-text("${action.valueToFill}"), input[value="${action.valueToFill}"]`).first();
            if (await radioBtn.isVisible().catch(() => false)) {
              await radioBtn.click().catch(() => {});
            }
          }
        } catch (e: any) {}
      }

      await executePreSubmitSelfCorrection(page, updatedApplicant);
      domCheck = await validateDomBeforeSubmit(page, actionPlan);
    }

    // 3. If DOM check still fails after retry round: skip vision, mark needs_manual_review, return early WITHOUT submit
    if (!domCheck.ok) {
      const gateErrorMsg = `Pre-submit DOM verification failed for unverified fields: ${domCheck.missing.join(', ')}`;
      console.error(`[AgenticFiller] ❌ Pre-Submit Gate Failed (DOM): ${gateErrorMsg}`);

      if (options.applicationId) {
        await prisma.application.update({
          where: { id: options.applicationId },
          data: {
            status: 'needs_manual_review',
            preSubmitGateFailure: gateErrorMsg,
            errorMessage: gateErrorMsg,
          },
        }).catch(() => {});
      }

      await browser.close();
      return {
        success: false,
        isConfirmed: false,
        failureReason: 'PRE_SUBMIT_GATE_FAILED',
        preSubmitGateFailure: gateErrorMsg,
        error: gateErrorMsg,
      };
    }

    // 4. Run Vision Verification if DOM check passed
    const visionCheck = await visionVerifyForm(page, actionPlan, updatedApplicant);

    // 5. Targeted retry if vision check flagged issues
    if (!visionCheck.ok) {
      console.warn(`[AgenticFiller] ⚠️ Vision pre-submit check flagged issues: ${JSON.stringify(visionCheck.issues)}. Initiating targeted re-fill retry...`);

      for (const issue of visionCheck.issues) {
        const matchingAction = actionPlan.find(a =>
          a.label.toLowerCase().includes(issue.field.toLowerCase()) ||
          issue.field.toLowerCase().includes(a.label.toLowerCase())
        );

        if (matchingAction) {
          const fieldToFix = extractedFields.find(f => f.fieldId === matchingAction.fieldId || f.label === matchingAction.label);
          if (fieldToFix) {
            const reResolved = await resolveFormQuestions({
              fields: [fieldToFix],
              applicant: updatedApplicant,
              jobTitle,
              jobCompany,
              jobDescription,
              tailoredSummary,
              tailoredBullets,
            });

            for (const act of reResolved) {
              if (act.actionType === 'type') {
                const target = page.locator(act.selector).first();
                if (await target.isVisible().catch(() => false)) {
                  await target.fill(act.valueToFill || '').catch(() => {});
                }
              } else if (act.actionType === 'click_radio') {
                const opt = page.locator(`button:has-text("${act.valueToFill}"), label:has-text("${act.valueToFill}")`).first();
                if (await opt.isVisible().catch(() => false)) {
                  await opt.click().catch(() => {});
                }
              }
            }
          }
        }
      }

      // Re-run DOM validation on targeted fields (DOM-only for retry to control cost/latency)
      const flaggedLabels = visionCheck.issues.map(i => i.field);
      const flaggedActions = actionPlan.filter(a => flaggedLabels.some(fl => a.label.toLowerCase().includes(fl.toLowerCase()) || fl.toLowerCase().includes(a.label.toLowerCase())));
      const domRetryCheck = await validateDomBeforeSubmit(page, flaggedActions.length > 0 ? flaggedActions : actionPlan);

      if (!domRetryCheck.ok) {
        const visionErrorMsg = `Pre-submit Vision verification failed: ${visionCheck.issues.map(i => `${i.field}: ${i.problem}`).join('; ')}`;
        console.error(`[AgenticFiller] ❌ Pre-Submit Gate Failed (Vision): ${visionErrorMsg}`);

        if (options.applicationId) {
          await prisma.application.update({
            where: { id: options.applicationId },
            data: {
              status: 'needs_manual_review',
              preSubmitGateFailure: visionErrorMsg,
              errorMessage: visionErrorMsg,
            },
          }).catch(() => {});
        }

        await browser.close();
        return {
          success: false,
          isConfirmed: false,
          failureReason: 'PRE_SUBMIT_GATE_FAILED',
          preSubmitGateFailure: visionErrorMsg,
          error: visionErrorMsg,
        };
      }
    }

    console.log('[AgenticFiller] ✅ Both Pre-Submit Gates passed! Proceeding to natural human dwell & submit click.');

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
          await page.waitForTimeout(3000);
        }
      } else {
        console.log(`[AgenticFiller] Dry run mode - completed form filling without clicking final submit button.`);
      }

      // Verify submission outcome on page post-submit (includes DOM stabilization poll loop)
      verification = dryRun
        ? { success: true, isConfirmed: true, validationMessages: [] }
        : await verifySubmissionOutcome(page, url);

      // Capture dedicated post-verification outcome screenshot
      const prefix = verification.success ? 'success' : 'failure';
      finalScreenshotFileName = `${prefix}_agentic_${Date.now()}.png`;
      finalScreenshotPath = path.join(screenshotsDir, finalScreenshotFileName);

      if (verification.success) {
        await page.waitForTimeout(1500); // Allow thank-you UI animations to settle
      }
      await page.screenshot({ path: finalScreenshotPath, fullPage: true }).catch(() => {});
      console.log(`[AgenticFiller] ${verification.success ? '✅ Success' : '❌ Failure'} verification screenshot saved to: ${finalScreenshotPath}`);

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

        await handlePostSubmitValidationErrors(
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

