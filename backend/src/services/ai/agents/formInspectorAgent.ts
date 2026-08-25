import { Page } from 'playwright';

export interface ExtractedFormField {
  selector: string;
  fieldId: string;
  name: string;
  type: 'text' | 'textarea' | 'radio' | 'select' | 'autocomplete' | 'file' | 'checkbox';
  label: string;
  placeholder?: string;
  options?: string[];
  required: boolean;
  currentValue?: string;
}

export async function extractFormFields(page: Page): Promise<ExtractedFormField[]> {
  console.log('[FormInspectorAgent] Extracting dynamic DOM form schema...');
  
  const fields: ExtractedFormField[] = await page.evaluate(() => {
    const extracted: ExtractedFormField[] = [];

    // 1. Text Inputs, Textareas, File Uploads, Selects
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select'));
    inputs.forEach((inputEl, index) => {
      const el = inputEl as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const rawType = ((el as HTMLInputElement).type || tagName).toLowerCase();
      if (rawType === 'submit' || rawType === 'button') return;

      // Extract label text inline
      let labelText = '';
      if (el.id) {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        if (lbl) labelText = lbl.textContent || '';
      }
      if (!labelText) {
        const closestLabel = el.closest('label');
        if (closestLabel) labelText = closestLabel.textContent || '';
      }
      if (!labelText) {
        const container = el.closest('div[class*="field"], fieldset, div[class*="question"], div[class*="Form"]');
        if (container) {
          const heading = container.querySelector('label, legend, h3, h4, span[class*="label"], p');
          if (heading) labelText = heading.textContent || '';
        }
      }
      if (!labelText && (el as HTMLInputElement).placeholder) {
        labelText = (el as HTMLInputElement).placeholder;
      }
      const cleanLabel = labelText.replace(/\s+/g, ' ').trim();

      let normType: ExtractedFormField['type'] = 'text';
      if (tagName === 'select' || (el as HTMLElement).getAttribute('role') === 'combobox' || /select/i.test(el.className || '')) {
        normType = 'select';
      } else if (rawType === 'textarea') normType = 'textarea';
      else if (rawType === 'file') normType = 'file';
      else if (rawType === 'radio') normType = 'radio';
      else if (rawType === 'checkbox') normType = 'checkbox';

      if (/location|address|city/i.test(cleanLabel) || /start typing/i.test((el as HTMLInputElement).placeholder || '')) {
        normType = 'autocomplete';
      }

      // Check required
      const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true' || cleanLabel.includes('*') || /required/i.test(cleanLabel);

      // Options if select
      let options: string[] | undefined = undefined;
      if (tagName === 'select') {
        options = Array.from((el as HTMLSelectElement).options).map(o => o.text.trim()).filter(Boolean);
      } else if (normType === 'select') {
        // Search for sibling or parent container option lists
        const container = el.closest('div[class*="field"], div[class*="question"], div[class*="select"], fieldset');
        if (container) {
          const optEls = Array.from(container.querySelectorAll('option, [role="option"], [class*="option"]'));
          if (optEls.length > 0) {
            options = optEls.map(o => o.textContent?.trim() || '').filter(Boolean);
          }
        }
      }

      // Unique CSS Selector
      let selector = '';
      if (el.id) selector = `[id="${el.id}"]`;
      else if ((el as HTMLInputElement).name) selector = `[name="${(el as HTMLInputElement).name}"]`;
      else selector = `${tagName}:nth-of-type(${index + 1})`;

      extracted.push({
        selector,
        fieldId: el.id || `field_${index}`,
        name: (el as HTMLInputElement).name || '',
        type: normType,
        label: cleanLabel || (el as HTMLInputElement).placeholder || `Input Field ${index + 1}`,
        placeholder: (el as HTMLInputElement).placeholder || '',
        options,
        required,
        currentValue: (el as HTMLInputElement).value || '',
      });
    });

    // 2. Custom Radio / Button Choice Containers (e.g. Ashby radio buttons, Yes/No buttons)
    const radioGroups = Array.from(document.querySelectorAll('fieldset, div[role="radiogroup"], div[class*="radio-group"], div[class*="choices"]'));
    radioGroups.forEach((group, gIdx) => {
      const legend = group.querySelector('legend, label, p, h4, h3')?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const optionElements = Array.from(group.querySelectorAll('label, button, input[type="radio"]'));
      const options: string[] = [];
      optionElements.forEach(opt => {
        const text = opt.textContent?.replace(/\s+/g, ' ').trim();
        if (text && !options.includes(text)) options.push(text);
      });

      if (options.length > 0 && legend) {
        // Deduplicate: skip if an individual radio input with the same label already exists
        const legendLower = legend.toLowerCase().replace(/[*\s]+/g, ' ').trim();
        const alreadyExists = extracted.some(f =>
          f.type === 'radio' && f.label.toLowerCase().replace(/[*\s]+/g, ' ').trim() === legendLower
        );
        if (!alreadyExists) {
          extracted.push({
            selector: `div[role="radiogroup"]:nth-of-type(${gIdx + 1})`,
            fieldId: `radio_group_${gIdx}`,
            name: legend,
            type: 'radio',
            label: legend,
            options,
            required: legend.includes('*') || /required/i.test(legend),
          });
        }
      }
    });

    return extracted;
  });

  console.log(`[FormInspectorAgent] Extracted ${fields.length} dynamic form fields.`);
  return fields;
}
