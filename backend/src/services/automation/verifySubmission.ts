import { Page } from 'playwright';

export interface VerificationResult {
  success: boolean;
  isConfirmed: boolean;
  requiresOtp?: boolean;
  otpEmail?: string;
  failureReason?: 'SPAM_FLAGGED' | 'VALIDATION_ERRORS' | 'RESUME_MISSING' | 'FORM_NOT_SUBMITTED' | 'UNKNOWN';
  validationMessages: string[];
  errorDetails?: string;
}

export async function verifySubmissionOutcome(page: Page, initialUrl: string): Promise<VerificationResult> {
  const maxPolls = 6;
  const pollIntervalMs = 1000;

  try {
    for (let poll = 0; poll < maxPolls; poll++) {
      await page.waitForTimeout(pollIntervalMs);

      const currentUrl = page.url();
      const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');

      console.log(`[SubmissionVerifier] Inspecting page post-submit (Poll ${poll + 1}/${maxPolls}, URL: ${currentUrl})...`);

      // 1. Check for Anti-Bot / Spam Flagging
      const isSpamFlagged =
        /flagged as (possible )?spam/i.test(pageText) ||
        /flagged as spam/i.test(pageText) ||
        /turn off your vpn or proxy/i.test(pageText) ||
        /anti-bot protection/i.test(pageText) ||
        (/cloudflare/i.test(pageText) && /access denied/i.test(pageText));

      if (isSpamFlagged) {
        console.warn(`[SubmissionVerifier] ❌ DETECTED SPAM FLAG banner on page!`);
        return {
          success: false,
          isConfirmed: false,
          failureReason: 'SPAM_FLAGGED',
          validationMessages: ['Your application submission was flagged as possible spam by ATS anti-bot protection.'],
          errorDetails: 'Submission flagged as possible spam by ATS.',
        };
      }

      // 2. Check for Email OTP Security Verification Code Prompts
      const isOtpRequired =
        /verification code was sent to/i.test(pageText) ||
        /enter the (8|6|4)-character code/i.test(pageText) ||
        (/security code/i.test(pageText) && /confirm you're a human/i.test(pageText));

      if (isOtpRequired) {
        const emailMatch = pageText.match(/sent to ([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        const targetEmail = emailMatch ? emailMatch[1] : '';

        console.log(`[SubmissionVerifier] 🔑 DETECTED OTP SECURITY VERIFICATION PROMPT for ${targetEmail}`);
        return {
          success: false,
          isConfirmed: false,
          requiresOtp: true,
          otpEmail: targetEmail,
          validationMessages: [`A security verification code was sent to ${targetEmail}. Please enter the code to complete submission.`],
          errorDetails: `Security OTP code required for ${targetEmail}.`,
        };
      }

      // 3. Check for Form Validation Error Banners & Field Error Messages
      const validationMessages: string[] = [];

      if (/your form needs corrections/i.test(pageText) || /we couldn't submit your application/i.test(pageText)) {
        console.warn(`[SubmissionVerifier] ❌ DETECTED Validation Error Banner!`);

        const extractedBullets = await page.evaluate(() => {
          const bullets: string[] = [];
          const items = document.querySelectorAll('li, div[class*="error"], span[class*="error"]');
          items.forEach((el) => {
            const txt = el.textContent?.trim();
            if (txt && (txt.includes('Missing entry') || txt.includes('required') || txt.includes('correct'))) {
              if (txt.length < 150 && !bullets.includes(txt)) {
                bullets.push(txt);
              }
            }
          });
          return bullets;
        }).catch(() => []);

        if (extractedBullets.length > 0) {
          validationMessages.push(...extractedBullets);
        } else {
          validationMessages.push('Form has missing required fields or validation errors.');
        }
      }

      const inlineErrors = await page.evaluate(() => {
        const errors: string[] = [];
        const errorElements = document.querySelectorAll('.field-error, .js-error, [aria-invalid="true"], [data-error], p[class*="error"], span[class*="error"]');
        errorElements.forEach((el) => {
          const txt = el.textContent?.trim();
          if (txt && txt.length > 3 && txt.length < 120 && !errors.includes(txt)) {
            errors.push(txt);
          }
        });
        return errors;
      }).catch(() => []);

      if (inlineErrors.length > 0) {
        for (const err of inlineErrors) {
          if (!validationMessages.includes(err)) {
            validationMessages.push(err);
          }
        }
      }

      if (validationMessages.length > 0) {
        console.warn(`[SubmissionVerifier] ❌ Validation errors found:`, validationMessages);
        return {
          success: false,
          isConfirmed: false,
          failureReason: 'VALIDATION_ERRORS',
          validationMessages,
          errorDetails: `Form validation failed: ${validationMessages.join('; ')}`,
        };
      }

      // 4. Check for Explicit Success Confirmation (URL or Text or Structural DOM)
      const isSuccessUrl = /\/(submitted|thanks|thankyou|thank-you|confirmation|applied|success|complete|done)/i.test(currentUrl);

      const isSuccessText =
        /thank\s*you\s+for\s+applying/i.test(pageText) ||
        /thank\s*you\s+for\s+your\s+interest/i.test(pageText) ||
        /thank\s*you\s+for\s+submitting/i.test(pageText) ||
        /application\s+(was|has\s+been|is)?\s*(submitted|received|accepted|sent)/i.test(pageText) ||
        /we('ve|\s+have)\s+received\s+your\s+application/i.test(pageText) ||
        /submission\s+(successful|received|complete)/i.test(pageText) ||
        /successfully\s+submitted/i.test(pageText) ||
        /response\s+has\s+been\s+recorded/i.test(pageText) ||
        /your\s+application\s+is\s+complete/i.test(pageText) ||
        /application\s+submitted/i.test(pageText) ||
        /thanks\s+for\s+applying/i.test(pageText);

      const isDomSuccessElement = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, div[class*="title"], div[class*="header"]'));
        const hasSuccessHeading = headings.some((h) => {
          const txt = h.textContent?.trim() || '';
          return /thank\s*you|application\s+submitted|submission\s+received|successfully\s+submitted/i.test(txt);
        });

        const hasSuccessContainer = Boolean(
          document.querySelector(
            '[class*="success"], [class*="thank"], [id*="success"], .ashby-application-submitted, .greenhouse-success, .lever-success, svg[class*="check"]'
          )
        );

        return hasSuccessHeading || hasSuccessContainer;
      }).catch(() => false);

      if (isSuccessUrl || isSuccessText || isDomSuccessElement) {
        console.log(`[SubmissionVerifier] ✅ Confirmed SUCCESSFUL application submission! (URL match: ${isSuccessUrl}, Text match: ${isSuccessText}, DOM match: ${isDomSuccessElement})`);
        return {
          success: true,
          isConfirmed: true,
          validationMessages: [],
        };
      }
    }

    // 5. Post-Polling Fallback Inspection
    const currentUrl = page.url();
    const isFormStillVisible = await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"], #submit_app, #btn-submit, input[type="submit"]');
      const textInputCount = document.querySelectorAll('input[type="text"], input[type="email"]').length;
      return Boolean(submitBtn && textInputCount > 0);
    }).catch(() => false);

    if (isFormStillVisible) {
      console.warn(`[SubmissionVerifier] ⚠️ Form inputs and submit button still visible post-submit without success confirmation.`);
      return {
        success: false,
        isConfirmed: false,
        failureReason: 'FORM_NOT_SUBMITTED',
        validationMessages: ['Form remained on application page after submit attempt without confirmation.'],
        errorDetails: 'Application form was not submitted (remained on application page).',
      };
    }

    // If form disappeared and URL changed from initial form URL
    const urlChanged = currentUrl !== initialUrl && !currentUrl.endsWith('/application') && !currentUrl.endsWith('/apply');
    if (urlChanged) {
      console.log(`[SubmissionVerifier] Page URL navigated away from form page (${initialUrl} -> ${currentUrl}). Submission confirmed.`);
      return {
        success: true,
        isConfirmed: true,
        validationMessages: [],
      };
    }

    // Default fallback: Form disappeared on same URL but no explicit confirmation text
    console.warn(`[SubmissionVerifier] ⚠️ Form inputs disappeared, but no explicit confirmation text found on URL: ${currentUrl}.`);
    return {
      success: true,
      isConfirmed: false,
      validationMessages: ['Form inputs disappeared post-submit, but explicit thank-you message was not detected.'],
    };
  } catch (err: any) {
    console.error(`[SubmissionVerifier] Error during outcome verification:`, err.message);
    return {
      success: false,
      isConfirmed: false,
      failureReason: 'UNKNOWN',
      validationMessages: [err.message],
      errorDetails: `Verification check error: ${err.message}`,
    };
  }
}
