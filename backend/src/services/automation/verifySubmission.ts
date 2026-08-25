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
  try {
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
    const pageHtml = await page.content().catch(() => '');

    console.log(`[SubmissionVerifier] Inspecting page post-submit (URL: ${currentUrl})...`);

    // 1. Check for Anti-Bot / Spam Flagging
    const isSpamFlagged =
      /flagged as (possible )?spam/i.test(pageText) ||
      /flagged as spam/i.test(pageText) ||
      /turn off your vpn or proxy/i.test(pageText) ||
      /anti-bot protection/i.test(pageText) ||
      /cloudflare/i.test(pageText) && /access denied/i.test(pageText);

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
      /security code/i.test(pageText) && /confirm you're a human/i.test(pageText);

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

    // 2. Check for Form Validation Error Banners & Field Error Messages
    const validationMessages: string[] = [];

    // Ashby & General error banner detection
    if (/your form needs corrections/i.test(pageText) || /we couldn't submit your application/i.test(pageText)) {
      console.warn(`[SubmissionVerifier] ❌ DETECTED Validation Error Banner!`);

      // Extract specific bulleted missing fields if present
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

    // Inline field validation errors (Greenhouse, Lever, Custom forms)
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

    // 3. Check for Explicit Success Confirmation
    const isSuccessUrl =
      /\/submitted/i.test(currentUrl) ||
      /\/thanks/i.test(currentUrl) ||
      /\/confirmation/i.test(currentUrl) ||
      /\/thank-you/i.test(currentUrl) ||
      /\/applied/i.test(currentUrl);

    const isSuccessText =
      /thank you for applying/i.test(pageText) ||
      /application received/i.test(pageText) ||
      /application submitted/i.test(pageText) ||
      /your application has been submitted/i.test(pageText) ||
      /we have received your application/i.test(pageText) ||
      /we've received your application/i.test(pageText);

    if (isSuccessUrl || isSuccessText) {
      console.log(`[SubmissionVerifier] ✅ Confirmed SUCCESSFUL application submission!`);
      return {
        success: true,
        isConfirmed: true,
        validationMessages: [],
      };
    }

    // 4. Fallback: Form Still Unsubmitted Check
    // If submit button or primary form inputs are still visible on page, form was not actually submitted
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

    // Default fallback if form disappeared but no explicit success text
    console.log(`[SubmissionVerifier] Page navigated away from form page. Assuming successful submission.`);
    return {
      success: true,
      isConfirmed: true,
      validationMessages: [],
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
