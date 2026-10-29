import {validRegion} from '../../fungi-ui/assets/regions.mjs';
export {validRegion};
// Adapted from jstack ff6ac0b; browser-native question and feedback validation.
export const VERSION = 1;
export const IMAGE_LIMITS = {count: 20, fileBytes: 5 * 1024 * 1024, totalBytes: 20 * 1024 * 1024};
export const IMAGE_EXTENSIONS = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp'};
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
function snapshot(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value) && JSON.stringify(value).length <= 12000, 'Prototype state must be a JSON object within 12,000 characters');
  return JSON.parse(JSON.stringify(value));
}
// Shared with the standalone form so drafts and downloads use the same bounds.

function preview(value) {
  requireValue(value && typeof value === 'object', 'Invalid preview');
  string(value.html, 'preview HTML', 4_000_000);
  const height = value.height ?? 280;
  requireValue(Number.isSafeInteger(height) && height >= 64 && height <= 1200, 'Preview height must be 64–1200 pixels');
  const anchors = value.anchors ?? [];
  requireValue(Array.isArray(anchors) && anchors.length <= 20 && anchors.every(a => typeof a === 'string' && a.trim() === a && a.length > 0 && a.length <= 100) && new Set(anchors).size === anchors.length, 'Invalid preview anchors');
  return {html: value.html, height, anchors, state: snapshot(value.state ?? {})};
}
export function previews(question) {
  return Object.fromEntries([...(question.preview ? [['main', question.preview]] : []), ...question.options.filter(o => o.preview).map(o => ['option-' + o.id, o.preview])]);
}
export function normalizeSpec(input, {richText = false, review = false} = {}) {
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
    const choices = q.options ?? (review ? [] : undefined);
    requireValue(Array.isArray(choices) && choices.length >= (review ? 0 : 2) && choices.length <= 8, `Use ${review ? '0' : '2'}–8 options for ${questionId}`);
    const optionIds = new Set();
    const labels = new Set();
    const options = choices.map((o, j) => {
      const optionId = id(typeof o === 'string' ? `option${j + 1}` : o?.id, 'option id');
      requireValue(!optionIds.has(optionId), `Duplicate option id: ${optionId}`); optionIds.add(optionId);
      const label = string(typeof o === 'string' ? o : o.label, 'option label', 1000);
      requireValue(!labels.has(label.toLowerCase()), `Duplicate option label: ${label}`); labels.add(label.toLowerCase());
      return {id: optionId, label, ...(review && o.preview !== undefined ? {preview: preview(o.preview)} : {})};
    });
    const context = string(q.context, 'context', richText ? 12000 : 3000, true);
    // New rich descriptions preserve indentation and line endings. Legacy sessions
    // retain their original normalization so saved question digests still match.
    const prompt = string(q.prompt, 'prompt', 2000, review);
    requireValue(!review || prompt || context || q.preview, `Provide a prompt, context, or preview for ${questionId}`);
    requireValue(!review || q.required === undefined || typeof q.required === 'boolean', 'Invalid required flag');
    return {id: questionId, number, prompt, context: richText ? q.context ?? '' : context, recommendation: string(q.recommendation, 'recommendation', 3000, review), options, ...(review ? {required: q.required === true, ...(q.preview !== undefined ? {preview: preview(q.preview)} : {})} : {})};
  });
  return {title, questions};
}
export function answered(answer) {
  return !!answer && (answer.choiceId === 'other' ? !!answer.notes?.trim() : !!answer.choiceId || !!answer.notes?.trim());
}
export function validateAnswers(spec, rawAnswers) {
  const state = {spec, review: true}, input = {answers: rawAnswers};
  requireValue(Array.isArray(input.answers) && input.answers.length === state.spec.questions.length, 'Submission must include every question exactly once');
  const byId = new Map();
  for (const a of input.answers) {
    requireValue(a && typeof a.questionId === 'string' && !byId.has(a.questionId), 'Duplicate or missing answer id');
    byId.set(a.questionId, a);
  }
  const imageIds = new Set();
  let imageBytes = 0;
  function validateNotes(a) {
    let notes = string(a.notes, 'notes', 12000, true);
    requireValue(a.images === undefined || Array.isArray(a.images), 'Invalid inline images');
    const images = [];
    let end = 0;
    for (const image of a.images ?? []) {
      requireValue(image && Number.isSafeInteger(image.id) && image.id > 0 && image.id <= 1_000_000 && !imageIds.has(image.id), 'Invalid or duplicate image id');
      imageIds.add(image.id);
      requireValue(imageIds.size <= IMAGE_LIMITS.count, 'Too many inline images');
      const token = `[Image #${image.id}]`;
      requireValue(Number.isSafeInteger(image.offset) && image.offset >= end && a.notes?.slice(image.offset, image.offset + token.length) === token, 'Image reference does not match notes');
      end = image.offset + token.length;
      const match = typeof image.dataUrl === 'string' && image.dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
      requireValue(match && match[2].length <= Math.ceil(IMAGE_LIMITS.fileBytes / 3) * 4, 'Invalid or oversized image data');
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0)), mimeType = match[1];
      requireValue(bytes.length <= IMAGE_LIMITS.fileBytes && btoa(atob(match[2])) === match[2], 'Invalid or oversized image encoding');
      const validHeader = mimeType === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
        : mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mimeType === 'image/gif' ? /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0, 6)))
        : String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
      requireValue(validHeader, 'Image data does not match its type');
      imageBytes += bytes.length;
      requireValue(imageBytes <= IMAGE_LIMITS.totalBytes, 'Inline images exceed the total size limit');
      images.push({id: image.id, offset: image.offset, mimeType, bytes: bytes.length, dataUrl: image.dataUrl});
    }
    // Offsets address the original text, including leading whitespace.
    if (images.length) notes = a.notes;
    return {notes, ...(images.length ? {images} : {})};
  }
  const answers = state.spec.questions.map(q => {
    const a = byId.get(q.id);
    requireValue(a && (a.choiceId === null || (q.options.length && a.choiceId === 'other') || q.options.some(o => o.id === a.choiceId)), `Invalid choice for ${q.id}`);
    const note = validateNotes(a);
    let reviewData = {};
    if (state.review) {
      const allowed = previews(q), states = a.states ?? {}, comments = a.comments ?? [];
      requireValue(states && typeof states === 'object' && !Array.isArray(states) && Object.keys(states).every(key => Object.hasOwn(allowed, key)), 'Invalid preview state target');
      const savedStates = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, snapshot(value)]));
      requireValue(Array.isArray(comments) && comments.length <= 20, 'Use at most 20 comments per item');
      const savedComments = comments.map(c => {
        requireValue(c && Object.hasOwn(allowed, c.preview), 'Invalid comment preview');
        // Keep existing named comments readable; new comments select any region.
        requireValue(c.region === undefined ? allowed[c.preview].anchors.includes(c.anchor) : c.anchor === undefined && validRegion(c.region), 'Invalid comment region or anchor');
        return {preview: c.preview, ...(c.region ? {region: JSON.parse(JSON.stringify(c.region))} : {anchor: c.anchor}), state: snapshot(c.state ?? {}), ...validateNotes(c)};
      }).filter(c => c.notes.trim());
      const changed = Object.entries(savedStates).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(allowed[key].state));
      const responded = answered({...a, notes: note.notes}) || savedComments.length > 0 || changed;
      requireValue(!q.required || responded, `Missing answer for ${q.id}`);
      requireValue(a.choiceId !== 'other' || note.notes.trim() || savedComments.length, `Explain Something else for ${q.id}`);
      reviewData = {status: responded ? 'feedback' : 'untouched', states: savedStates, comments: savedComments};
    } else requireValue(answered({...a, notes: note.notes}), `Missing answer for ${q.id}`);
    return {questionId: q.id, number: q.number, question: q.prompt, choiceId: a.choiceId, choice: a.choiceId === 'other' ? 'Something else' : q.options.find(o => o.id === a.choiceId)?.label ?? null, ...note, ...reviewData};
  });
  requireValue(!state.review || answers.some(a => a.status === 'feedback'), 'Provide some feedback before submitting');
  return {schemaVersion: VERSION, title: state.spec.title, answers};
}
