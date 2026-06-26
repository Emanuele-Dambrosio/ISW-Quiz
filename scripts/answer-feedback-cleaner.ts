const FEEDBACK_BLOCK_RE =
  /\s*<div\b[^>]*class=(["'])[^"']*\bspecificfeedback\b[^"']*\1[^>]*>[\s\S]*?<\/div>\s*/gi;
const ANSWER_FEEDBACK_ICON_RE =
  /\s*<span\b[^>]*>\s*<i\b(?=[^>]*(?:aria-label|title)=(["'])Risposta (?:corretta|errata)\1)[^>]*><\/i>\s*<\/span>\s*/gi;
const ANSWER_FEEDBACK_TEXT_RE = /\s*\b(?:Correct|Incorrect)\.\s*$/i;

export function cleanAnswerFeedbackHtml(value: string) {
  return value.replace(FEEDBACK_BLOCK_RE, "").replace(ANSWER_FEEDBACK_ICON_RE, "").trim();
}

export function cleanAnswerFeedbackPlain(value: string) {
  return value.replace(ANSWER_FEEDBACK_TEXT_RE, "").trim();
}
