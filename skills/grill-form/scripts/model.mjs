// Validate question data and downloaded submissions without external dependencies.
export const VERSION = 1;
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function string(value, name, max = 12000, optional = false) {
  if (optional && value === undefined) return '';
  requireValue(typeof value === 'string' && value.length <= max && (optional || value.trim()), `Invalid ${name}`);
  return value.trim();
}
function id(value, name) {
  requireValue(typeof value === 'string' && idPattern.test(value) && value !== 'other', `Invalid ${name}`);
  return value;
}
export function normalizeSpec(input) {
  requireValue(input && typeof input === 'object', 'Expected a question object');
  const title = string(input.title, 'title', 200);
  requireValue(Array.isArray(input.questions) && input.questions.length >= 1 && input.questions.length <= 10, 'Use 1–10 questions per round');
  const seen = new Set(), numbers = new Set();
  const questions = input.questions.map((q, i) => {
    requireValue(q && typeof q === 'object', 'Each question must be an object');
    const number = q.number ?? i + 1;
    requireValue(Number.isSafeInteger(number) && number > 0 && !numbers.has(number), 'Question numbers must be positive and unique'); numbers.add(number);
    const questionId = id(q.id ?? `q${number}`, 'question id');
    requireValue(!seen.has(questionId), `Duplicate question id: ${questionId}`); seen.add(questionId);
    requireValue(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 8, `Use 2–8 options for ${questionId}`);
    const optionIds = new Set();
    const labels = new Set();
    const options = q.options.map((o, j) => {
      const optionId = id(typeof o === 'string' ? `option${j + 1}` : o?.id, 'option id');
      requireValue(!optionIds.has(optionId), `Duplicate option id: ${optionId}`); optionIds.add(optionId);
      const label = string(typeof o === 'string' ? o : o.label, 'option label', 1000);
      requireValue(!labels.has(label.toLowerCase()), `Duplicate option label: ${label}`); labels.add(label.toLowerCase());
      return {id: optionId, label};
    });
    return {id: questionId, number, prompt: string(q.prompt, 'prompt', 2000), context: string(q.context, 'context', 3000, true), recommendation: string(q.recommendation, 'recommendation', 3000), options};
  });
  return {title, questions};
}
export function answered(answer) {
  return !!answer && (answer.choiceId === 'other' ? !!answer.notes?.trim() : !!answer.choiceId || !!answer.notes?.trim());
}
export function validateSubmission(state, input) {
  requireValue(input?.schemaVersion === VERSION && input.sessionId === state.sessionId && input.specDigest === state.specDigest, 'Submission belongs to a different session or question revision');
  requireValue(Array.isArray(input.answers) && input.answers.length === state.spec.questions.length, 'Submission must answer every question exactly once');
  const byId = new Map();
  for (const a of input.answers) {
    requireValue(a && typeof a.questionId === 'string' && !byId.has(a.questionId), 'Duplicate or missing answer id');
    byId.set(a.questionId, a);
  }
  const answers = state.spec.questions.map(q => {
    const a = byId.get(q.id);
    requireValue(a && (a.choiceId === null || a.choiceId === 'other' || q.options.some(o => o.id === a.choiceId)), `Invalid choice for ${q.id}`);
    const notes = string(a.notes, 'notes', 12000, true);
    requireValue(answered({...a, notes}), `Missing answer for ${q.id}`);
    return {questionId: q.id, number: q.number, question: q.prompt, choiceId: a.choiceId, choice: a.choiceId === 'other' ? 'Something else' : q.options.find(o => o.id === a.choiceId)?.label ?? null, notes};
  });
  return {schemaVersion: VERSION, sessionId: state.sessionId, title: state.spec.title, answers};
}
