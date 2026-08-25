import { ApplicantInfo } from '../../automation/types';
import { ExtractedFormField } from './formInspectorAgent';
import { generateLLMCompletion, isLLMAvailable, getActiveLLMProvider } from '../llm';

export interface FieldAction {
  fieldId: string;
  selector: string;
  label: string;
  actionType: 'type' | 'select_option' | 'click_radio' | 'autocomplete' | 'upload_file' | 'skip';
  valueToFill: string;
  reasoning?: string;
}

export interface ResolverParams {
  fields: ExtractedFormField[];
  applicant: ApplicantInfo;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  tailoredSummary?: string;
  tailoredBullets?: string[];
}

export async function resolveFormQuestions(params: ResolverParams): Promise<FieldAction[]> {
  const { fields, applicant, jobTitle, jobCompany, jobDescription, tailoredSummary, tailoredBullets } = params;

  console.log(`[QuestionResolverAgent] Resolving dynamic actions for ${fields.length} form fields...`);

  // Default heuristic resolver fallback
  const fallbackActions = fields.map(field => heuristicResolveField(field, applicant, jobTitle, jobCompany));

  if (!isLLMAvailable()) {
    console.warn('[QuestionResolverAgent] No OPENAI_API_KEY or ANTHROPIC_API_KEY set. Using heuristic fallback resolver.');
    return fallbackActions;
  }

  try {
    const prompt = `You are an expert Job Application Agent. Resolve each form field for a candidate applying to ${jobTitle} at ${jobCompany}.

Candidate Profile:
- Full Name: ${applicant.fullName}
- Email: ${applicant.email}
- Phone: ${applicant.phone || '555-019-2831'}
- Location: ${applicant.location || 'San Francisco, CA'}
- LinkedIn: ${applicant.linkedinUrl || 'https://linkedin.com/in/rishu-kumar'}
- GitHub: ${applicant.githubUrl || 'https://github.com/rishugren03'}
- Portfolio: ${applicant.portfolioUrl || 'https://github.com/rishugren03'}
- Work Authorization: ${applicant.legallyAuthorized !== false ? 'Authorized to work' : 'Requires authorization'}
- Visa Sponsorship: ${applicant.requiresSponsorship ? 'Requires sponsorship' : 'Does not require sponsorship'}
- Relocation: ${applicant.openToRelocation !== false ? 'Yes' : 'No'}
- In-Person / Hybrid: ${applicant.openToInPerson !== false ? 'Yes' : 'No'}
- Gender: ${applicant.gender || 'Decline to self-identify'}
- Race: ${applicant.race || 'Decline to self-identify'}
- Veteran Status: ${applicant.veteranStatus || 'Decline to self-identify'}
- Disability: ${applicant.disabilityStatus || 'Decline to self-identify'}
- Summary: ${tailoredSummary || ''}
- Key Highlights: ${JSON.stringify(tailoredBullets || [])}

Job Description Snippet:
${jobDescription.slice(0, 1500)}

Form Fields to Resolve:
${JSON.stringify(fields, null, 2)}

STRICT RULES:
1. For open-ended long-form prompts (e.g. "Why this company?", "Impactful project?", "How did you know it worked?", "Have you used product X?"), generate **distinct, concise, high-impact answers** (2-4 sentences max). DO NOT output duplicate text across different questions!
2. For link fields (LinkedIn, GitHub, Portfolio), output candidate's exact valid URL.
3. For radio or select fields, pick the EXACT option text string from the field's "options" list.
4. For location/address input, output candidate's city & state string (e.g. "${applicant.location || 'San Francisco, CA'}").

Return ONLY valid JSON matching this schema with NO markdown wrapping:
[
  {
    "fieldId": "fieldId from input",
    "selector": "selector from input",
    "label": "label text",
    "actionType": "type | select_option | click_radio | autocomplete | upload_file | skip",
    "valueToFill": "exact value to fill or select",
    "reasoning": "brief explanation of why this value was chosen"
  }
]`;

    const textContent = await generateLLMCompletion({
      prompt,
      maxTokens: 3000,
    });

    const cleanJsonStr = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const resolvedActions: FieldAction[] = JSON.parse(cleanJsonStr);

    console.log(`[QuestionResolverAgent] Successfully resolved ${resolvedActions.length} dynamic field actions via ${getActiveLLMProvider().toUpperCase()}.`);
    return resolvedActions;
  } catch (err: any) {
    console.error('[QuestionResolverAgent] LLM resolution failed, using fallback:', err.message);
    return fallbackActions;
  }
}

function heuristicResolveField(
  field: ExtractedFormField,
  applicant: ApplicantInfo,
  jobTitle: string,
  jobCompany: string
): FieldAction {
  const lbl = field.label.toLowerCase();

  if (/^name\*?$|full name|preferred name|first and last/i.test(lbl) || field.fieldId.includes('name')) {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'type', valueToFill: applicant.fullName };
  }
  if (/email/i.test(lbl)) {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'type', valueToFill: applicant.email };
  }
  if (/phone/i.test(lbl)) {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'type', valueToFill: applicant.phone || '555-019-2831' };
  }
  if (/linkedin/i.test(lbl)) {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'type', valueToFill: applicant.linkedinUrl || 'https://linkedin.com/in/rishu-kumar' };
  }
  if (/github/i.test(lbl)) {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'type', valueToFill: applicant.githubUrl || 'https://github.com/rishugren03' };
  }
  if (/website|portfolio/i.test(lbl)) {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'type', valueToFill: applicant.portfolioUrl || 'https://github.com/rishugren03' };
  }
  if (/location|city|country/i.test(lbl) || field.type === 'autocomplete') {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'autocomplete', valueToFill: applicant.location || 'San Francisco, CA' };
  }
  if (field.type === 'file' || /resume|cv/i.test(lbl)) {
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'upload_file', valueToFill: applicant.resumePath || '' };
  }
  if (field.type === 'radio' && field.options && field.options.length > 0) {
    if (/hear|how did you/i.test(lbl)) {
      const match = field.options.find(o => /job board|social|linkedin|other/i.test(o)) || field.options[0];
      return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'click_radio', valueToFill: match };
    }
    const yesNoMatch = field.options.find(o => o.toLowerCase() === 'yes') || field.options[0];
    return { fieldId: field.fieldId, selector: field.selector, label: field.label, actionType: 'click_radio', valueToFill: yesNoMatch };
  }

  if (field.type === 'select' || (field.options && field.options.length > 0 && field.type !== 'radio')) {
    let chosenVal = '';
    const opts = field.options || [];

    if (/gender/i.test(lbl)) {
      chosenVal = opts.find(o => new RegExp(applicant.gender || 'decline', 'i').test(o)) || opts.find(o => /male|decline/i.test(o)) || opts[0];
    } else if (/race|ethnicity/i.test(lbl)) {
      chosenVal = opts.find(o => new RegExp(applicant.race || 'decline', 'i').test(o)) || opts.find(o => /asian|decline/i.test(o)) || opts[0];
    } else if (/veteran/i.test(lbl)) {
      chosenVal = opts.find(o => /not a protected|decline|no/i.test(o)) || opts[0];
    } else if (/disability/i.test(lbl)) {
      chosenVal = opts.find(o => /no, i don't|decline|no/i.test(o)) || opts[0];
    } else if (/school|university|college/i.test(lbl)) {
      chosenVal = opts.find(o => /other|stanford|berkeley|mit|university/i.test(o)) || opts[0];
    } else if (/degree/i.test(lbl)) {
      chosenVal = opts.find(o => /bachelor|master|bs|ba/i.test(o)) || opts[0];
    } else if (/discipline|major/i.test(lbl)) {
      chosenVal = opts.find(o => /computer science|software|engineering/i.test(o)) || opts[0];
    } else if (/month/i.test(lbl)) {
      chosenVal = opts.find(o => /may|june|december|05|06|12/i.test(o)) || opts[opts.length > 1 ? 1 : 0];
    } else if (/year/i.test(lbl)) {
      chosenVal = opts.find(o => /2026|2027|2025/i.test(o)) || opts[opts.length - 1];
    } else if (/authorization|legally authorized|work in/i.test(lbl)) {
      chosenVal = opts.find(o => /yes/i.test(o)) || opts[0];
    } else if (/sponsorship/i.test(lbl)) {
      chosenVal = opts.find(o => /yes/i.test(o)) || opts[0];
    } else if (opts.length > 0) {
      chosenVal = opts.find(o => /yes|united states|other|job board|linkedin/i.test(o)) || opts[0];
    }

    return {
      fieldId: field.fieldId,
      selector: field.selector,
      label: field.label,
      actionType: 'select_option',
      valueToFill: chosenVal,
    };
  }

  // Textarea / Open-ended prompt
  let ans = `I am eager to contribute my background in AI engineering, LLM agent workflows, and software performance to ${jobCompany} for the ${jobTitle} role.`;
  if (/impact|built|contribution/i.test(lbl)) {
    ans = `I built an autonomous multi-agent application system with Playwright and Claude 3.5 Sonnet that dynamically parses complex ATS forms and populates fields with 99%+ accuracy, saving hundreds of engineering hours.`;
  } else if (/success|how did you know/i.test(lbl)) {
    ans = `Success was measured by achieving a 100% field completion rate on automated submissions and reducing job application latency to under 15 seconds per post with zero validation errors.`;
  } else if (/used|explore|project/i.test(lbl)) {
    ans = `Yes, I have integrated AI APIs and streaming speech/text models in several side projects to build real-time interactive agents and user-facing AI applications.`;
  }

  return {
    fieldId: field.fieldId,
    selector: field.selector,
    label: field.label,
    actionType: field.type === 'textarea' ? 'type' : 'type',
    valueToFill: ans,
  };
}
