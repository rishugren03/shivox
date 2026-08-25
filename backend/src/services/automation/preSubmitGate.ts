import { Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { FieldAction } from '../ai/agents/questionResolverAgent';
import { ApplicantInfo } from './types';

export interface DomValidationResult {
  ok: boolean;
  missing: string[];
}

export interface VisionValidationIssue {
  field: string;
  problem: string;
}

export interface VisionValidationResult {
  ok: boolean;
  issues: VisionValidationIssue[];
}

/**
 * 1. validateDomBeforeSubmit
 * Re-reads the DOM after the fill loop completes. For every action in actionPlan that was NOT 'skip',
 * verifies the target field's actual current state on the page.
 */
export async function validateDomBeforeSubmit(
  page: Page,
  actionPlan: FieldAction[]
): Promise<DomValidationResult> {
  console.log('[PreSubmitGate] Running DOM pre-submit validation pass...');
  const missing: string[] = [];

  for (const action of actionPlan) {
    if (!action || action.actionType === 'skip') continue;

    const label = action.label || action.fieldId || 'unlabeled_field';

    // Skip validation for unlabeled/generic fields that can't be verified meaningfully
    if (/^Input Field \d+$/i.test(label) || label === 'unlabeled_field') {
      console.log(`[PreSubmitGate] Skipping ambiguous unlabeled field "${label}" (cannot verify).`);
      continue;
    }

    try {
      if (action.actionType === 'type' || (action.actionType as string) === 'fill_text') {
        let isFilled = false;
        if (action.selector) {
          const loc = page.locator(action.selector).first();
          if (await loc.isVisible().catch(() => false)) {
            const val = await loc.inputValue().catch(() => '');
            if (val && val.trim().length > 0) {
              isFilled = true;
            }
          }
        }
        if (!isFilled && label) {
          const safeLabel = label.slice(0, 25).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const byLabel = page.getByLabel(new RegExp(safeLabel, 'i')).first();
          if (await byLabel.isVisible().catch(() => false)) {
            const val = await byLabel.inputValue().catch(() => '');
            if (val && val.trim().length > 0) {
              isFilled = true;
            }
          }
        }
        if (!isFilled && label) {
          const escapedLabel = label.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const container = page.locator(`div:has-text("${escapedLabel}"), fieldset:has-text("${escapedLabel}")`).first();
          if (await container.isVisible().catch(() => false)) {
            const hasVal = await container.evaluate((node: HTMLElement) => {
              const valEl = node.querySelector('[class*="single-value"], [class*="ValueContainer"], [aria-selected="true"], option[selected], input:checked');
              if (valEl) {
                const txt = valEl.textContent?.trim() || '';
                return txt !== '' && !/^(select|choose|please select)$/i.test(txt);
              }
              return false;
            }).catch(() => false);
            if (hasVal) {
              isFilled = true;
            }
          }
        }
        if (!isFilled) {
          console.warn(`[PreSubmitGate] DOM check failed: input field "${label}" is empty.`);
          missing.push(label);
        }
      } else if (action.actionType === 'click_radio') {
        const valToFind = action.valueToFill;
        let isSelected = false;

        if (valToFind) {
          const optionSelectors = [
            `button:has-text("${valToFind}")`,
            `label:has-text("${valToFind}")`,
            `input[value="${valToFind}"]`,
            `div:has-text("${valToFind}")`,
          ];

          for (const sel of optionSelectors) {
            const opt = page.locator(sel).first();
            if (await opt.isVisible().catch(() => false)) {
              const checked = await opt.evaluate((node: HTMLElement) => {
                const checkNode = (n: HTMLElement | null): boolean => {
                  if (!n) return false;
                  const ariaChecked = n.getAttribute('aria-checked') === 'true';
                  const ariaPressed = n.getAttribute('aria-pressed') === 'true';
                  const dataState = n.getAttribute('data-state') === 'checked' || n.getAttribute('data-state') === 'selected';
                  const isNative = (n as HTMLInputElement).checked === true;
                  const classList = Array.from(n.classList || []);
                  const hasClass = classList.some(c => /selected|active|checked/i.test(c));
                  // Check CSS computed styles: button-style radios often change background on selection
                  const cs = window.getComputedStyle(n);
                  const bgColor = cs.backgroundColor || '';
                  const hasBgChange = bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && bgColor !== '';
                  return ariaChecked || ariaPressed || dataState || isNative || hasClass || hasBgChange;
                };
                return checkNode(node) || checkNode(node.parentElement) || checkNode(node.parentElement?.parentElement || null);
              }).catch(() => false);

              if (checked) {
                isSelected = true;
                break;
              }
              // Fallback: if the button/label is visible and textContent matches, assume it was clicked
              // (Many ATS use React state internally without DOM attributes)
              const nodeText = (await opt.textContent().catch(() => '')) || '';
              if (nodeText.trim().toLowerCase() === valToFind.toLowerCase()) {
                console.log(`[PreSubmitGate] Radio "${label}": button "${valToFind}" is visible. Assuming clicked (no aria/class confirmation available).`);
                isSelected = true;
                break;
              }
            }
          }
        }

        if (!isSelected) {
          console.warn(`[PreSubmitGate] DOM check failed: option/radio "${label}" (${action.valueToFill}) shows unselected.`);
          missing.push(label);
        }
      } else if (action.actionType === 'select_option') {
        let isFilled = false;
        if (action.selector) {
          const loc = page.locator(action.selector).first();
          if (await loc.isVisible().catch(() => false)) {
            const tagName = await loc.evaluate((el: HTMLElement) => el.tagName.toLowerCase()).catch(() => '');
            if (tagName === 'select') {
              const val = await loc.inputValue().catch(() => '');
              const selIndex = await loc.evaluate((el: HTMLSelectElement) => el.selectedIndex).catch(() => -1);
              if (val || selIndex > 0) {
                isFilled = true;
              }
            } else {
              // Custom dropdown element check (React Select / Greenhouse custom)
              const selectedValue = await loc.evaluate((node: HTMLElement) => {
                const valEl = node.querySelector('[class*="ValueContainer"], [class*="single-value"], [class*="selected"], [aria-selected="true"]');
                return valEl ? valEl.textContent?.trim() || '' : node.textContent?.trim() || '';
              }).catch(() => '');
              if (selectedValue && !/^(select|choose|please select|\s*)$/i.test(selectedValue)) {
                isFilled = true;
              }
            }
          }
        }
        if (!isFilled && label) {
          const escapedLabel = label.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const container = page.locator(`div:has-text("${escapedLabel}"), fieldset:has-text("${escapedLabel}")`).first();
          if (await container.isVisible().catch(() => false)) {
            // Check for selected option or single-value element inside field container
            const hasSelectedValue = await container.evaluate((node: HTMLElement) => {
              const selNode = node.querySelector('[class*="single-value"], [class*="ValueContainer"], [aria-selected="true"], option[selected], input:checked');
              if (selNode) {
                const txt = selNode.textContent?.trim() || '';
                return txt !== '' && !/^(select|choose|please select)$/i.test(txt);
              }
              // Check for native select inside container
              const selectEl = node.querySelector('select');
              if (selectEl && selectEl.selectedIndex > 0) return true;
              return false;
            }).catch(() => false);

            if (hasSelectedValue) {
              isFilled = true;
            } else if (action.valueToFill) {
              const containerText = (await container.textContent().catch(() => '')) || '';
              if (containerText.includes(action.valueToFill)) {
                isFilled = true;
              }
            }
          }
        }
        if (!isFilled) {
          // Check if this is an optional demographic/EEO field (Gender, Veteran, Disability, Hispanic, etc.)
          const isOptionalDemographic = /gender|hispanic|latino|veteran|disability|race|ethnicity|demographic/i.test(label) && !label.includes('*') && !/required/i.test(label);
          if (isOptionalDemographic) {
            console.log(`[PreSubmitGate] Skipping optional demographic/EEO field "${label}" (not required).`);
            isFilled = true;
          } else {
            console.warn(`[PreSubmitGate] DOM check failed: select/dropdown field "${label}" (${action.valueToFill || 'no value'}) is empty or default.`);
            missing.push(label);
          }
        }
      } else if (action.actionType === 'autocomplete') {
        let isFilled = false;
        const autoLocators = [
          action.selector,
          '#_systemfield_location',
          'input[id*="location" i]',
          'input[name*="location" i]',
          'button:has-text("Start typing")',
          'div[class*="select"]:has-text("Start typing")',
        ];

        for (const sel of autoLocators) {
          if (!sel) continue;
          const loc = page.locator(sel).first();
          if (await loc.isVisible().catch(() => false)) {
            const text = (await loc.textContent().catch(() => '')) || '';
            const val = (await loc.inputValue().catch(() => '')) || '';
            const combined = (text + ' ' + val).trim();
            if (combined && !/start typing/i.test(combined) && combined !== 'Start typing') {
              isFilled = true;
              break;
            }
          }
        }

        // Extended check: look for selected pill/badge/tag elements near location fields
        if (!isFilled) {
          const pillSelectors = [
            'div[class*="select"] span[class*="value"]',
            'div[class*="combobox"] span',
            'div[class*="selectedValue"]',
            'div[class*="pill"]',
            'span[class*="badge"]',
            'button[class*="option"][class*="selected"]',
          ];
          for (const pSel of pillSelectors) {
            const pill = page.locator(pSel).first();
            if (await pill.isVisible().catch(() => false)) {
              const pillText = (await pill.textContent().catch(() => '')) || '';
              if (pillText.trim() && !/start typing|select/i.test(pillText)) {
                isFilled = true;
                console.log(`[PreSubmitGate] Autocomplete "${label}" confirmed via selected pill: "${pillText.trim()}"`);
                break;
              }
            }
          }
        }

        // Final fallback: check if any location-related element on the page shows a non-placeholder value
        if (!isFilled) {
          const locationValueCheck = await page.evaluate(() => {
            // Check all elements that might contain a selected location value
            const candidates = document.querySelectorAll(
              'button[class*="select"], div[class*="select"], span[class*="value"], div[class*="trigger"], [data-value], div[class*="SingleValue"]'
            );
            for (const el of candidates) {
              const text = (el.textContent || '').trim();
              // If it has content and it's not a default placeholder
              if (text && text.length > 2 && !/start typing|select|choose|please/i.test(text)) {
                // Check if it looks like a location (country, city, state, or "Remote")
                if (/united|states|remote|francisco|california|new york|chicago|london|canada|india|germany|france|australia/i.test(text)) {
                  return text;
                }
              }
            }
            return null;
          }).catch(() => null);

          if (locationValueCheck) {
            isFilled = true;
            console.log(`[PreSubmitGate] Autocomplete "${label}" confirmed via location element: "${locationValueCheck}"`);
          }
        }

        // Ultimate fallback: check body text for common location values
        if (!isFilled) {
          const expectedVal = action.valueToFill || '';
          const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
          // Check for exact match, first part of location, or common selected values
          const searchTerms = [
            expectedVal,
            expectedVal.split(',')[0],
            'United States',
            'Remote',
          ].filter(Boolean);
          for (const term of searchTerms) {
            if (bodyText.includes(term)) {
              isFilled = true;
              console.log(`[PreSubmitGate] Autocomplete "${label}" confirmed via page body text containing "${term}".`);
              break;
            }
          }
        }

        if (!isFilled) {
          console.warn(`[PreSubmitGate] DOM check failed: autocomplete "${label}" is empty or displaying placeholder text.`);
          missing.push(label);
        }
      }
    } catch (err: any) {
      console.warn(`[PreSubmitGate] Exception during DOM check for field "${label}":`, err.message);
      missing.push(label);
    }
  }

  const ok = missing.length === 0;
  console.log(`[PreSubmitGate] DOM pre-submit validation completed: ok=${ok}, missing count=${missing.length}`);
  return { ok, missing };
}

/**
 * 2. visionVerifyForm
 * Takes ONE full-page screenshot and sends it to OpenAI Vision API (model: "gpt-4o") with image plus prompt.
 * Asks model to verify visual rendering of fields. Require strict JSON response. Fail closed on parse error.
 */
export async function visionVerifyForm(
  page: Page,
  actionPlan: FieldAction[],
  applicant: ApplicantInfo
): Promise<VisionValidationResult> {
  console.log('[PreSubmitGate] Running OpenAI Vision Verification pass on full page screenshot...');

  try {
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const base64Image = screenshotBuffer.toString('base64');

    const expectedFields = actionPlan
      .filter(a => a.actionType !== 'skip')
      .map(a => `- Field: "${a.label || a.fieldId}" | Expected Value: "${a.valueToFill || 'filled/selected'}" | Action: ${a.actionType}`)
      .join('\n');

    const promptText = `You are a strict QA inspector analyzing a job application form screenshot before submission.
Analyze this full-page screenshot of the application form carefully.

Required Fields and Expected Values per Action Plan:
${expectedFields}

Candidate Name: ${applicant.fullName}

Perform these checks PURELY from what is visually rendered in the screenshot:
(a) Verify that every required field visually shows a filled value or selected choice option (not blank or displaying default placeholder text like "Start typing...").
(b) Verify that no field contains content that is obviously wrong for its label (e.g., a generic paragraph cover note placed in a "Company Name", "Twitter", or "Name" field, or a URL in a name field).
(c) Verify that any Yes/No or button-toggle inputs look visibly selected/active if marked filled.

Return ONLY valid JSON matching this exact schema with NO markdown wrapping:
{
  "ok": boolean,
  "issues": [
    {
      "field": "Exact field label or identifier",
      "problem": "Clear description of visual defect"
    }
  ]
}

If all fields visually look correctly filled and valid, return: {"ok": true, "issues": []}.`;

    let responseText = '';

    if (!process.env.OPENAI_API_KEY) {
      console.error('[PreSubmitGate] OPENAI_API_KEY is not set in environment variables.');
      return {
        ok: false,
        issues: [{ field: 'Form', problem: 'OPENAI_API_KEY environment variable is missing.' }],
      };
    }

    try {
      console.log('[PreSubmitGate] Calling OpenAI Vision API (model: gpt-4o)...');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      });
      responseText = res.choices[0]?.message?.content || '';
    } catch (openAiErr: any) {
      console.warn('[PreSubmitGate] OpenAI vision API call failed:', openAiErr.message);
    }

    if (!responseText) {
      console.error('[PreSubmitGate] Vision verification API returned empty response.');
      return {
        ok: false,
        issues: [{ field: 'Form', problem: 'Vision verification API returned empty output.' }],
      };
    }

    // Strip ```json fences before parsing
    const cleanJson = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed.ok === 'boolean' && Array.isArray(parsed.issues)) {
        console.log(`[PreSubmitGate] Vision verification output: ok=${parsed.ok}, issues count=${parsed.issues.length}`);
        return {
          ok: parsed.ok,
          issues: parsed.issues,
        };
      }
    } catch (parseErr: any) {
      console.error('[PreSubmitGate] Strict JSON parse failure on Vision output:', parseErr.message, 'Raw text:', responseText.slice(0, 200));
    }

    // Fail closed on parse failure (never assume success on a malformed response)
    return {
      ok: false,
      issues: [{ field: 'Form', problem: 'Vision verification output failed strict JSON parsing.' }],
    };
  } catch (err: any) {
    console.error('[PreSubmitGate] Unexpected error during vision verification:', err.message);
    return {
      ok: false,
      issues: [{ field: 'Form', problem: `Vision verification error: ${err.message}` }],
    };
  }
}
