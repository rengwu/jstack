import {validRegion} from '../../fungi-ui/assets/regions.mjs';
export {validRegion};
// Adapted from jstack ff6ac0b; browser-native question and feedback validation.
export const VERSION = 2;
export const IMAGE_EXTENSIONS = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp'};
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function string(value, name, optional = false) {
  if (optional && value === undefined) return '';
  requireValue(typeof value === 'string' && (optional || value.trim()), `Invalid ${name}`);
  return value.trim();
}
function id(value, name) {
  requireValue(typeof value === 'string' && idPattern.test(value) && value !== 'other', `Invalid ${name}`);
  return value;
}
function snapshot(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), 'Prototype state must be a JSON object');
  return JSON.parse(JSON.stringify(value));
}
// Drafts and submissions share structure validation; transport owns byte budgets.

function preview(value) {
  requireValue(value && typeof value === 'object', 'Invalid preview');
  string(value.html, 'preview HTML');
  const height = value.height ?? 280;
  requireValue(Number.isSafeInteger(height) && height > 0, 'Preview height must be a positive integer');
  const anchors = value.anchors ?? [];
  requireValue(Array.isArray(anchors) && anchors.every(a => typeof a === 'string' && a.trim() === a && a.length > 0) && new Set(anchors).size === anchors.length, 'Invalid preview anchors');
  return {html: value.html, height, anchors, state: snapshot(value.state ?? {})};
}
export function previews(question) {
  return Object.fromEntries([...(question.preview ? [['main', question.preview]] : []), ...question.options.filter(o => o.preview).map(o => ['option-' + o.id, o.preview])]);
}
export function normalizeSpec(input) {
  requireValue(input && typeof input === 'object', 'Expected a question object');
  const title = string(input.title, 'title');
  requireValue(Array.isArray(input.questions) && input.questions.length > 0, 'Provide at least one question');
  const seen = new Set(), numbers = new Set();
  const questions = input.questions.map((q, i) => {
    requireValue(q && typeof q === 'object', 'Each question must be an object');
    const number = q.number ?? i + 1;
    requireValue(Number.isSafeInteger(number) && number > 0 && !numbers.has(number), 'Question numbers must be positive and unique'); numbers.add(number);
    const questionId = id(q.id ?? `q${number}`, 'question id');
    requireValue(!seen.has(questionId), `Duplicate question id: ${questionId}`); seen.add(questionId);
    const choices = q.options ?? [];
    requireValue(Array.isArray(choices), `Provide options as a list for ${questionId}`);
    const selection = q.selection === undefined ? 'single' : q.selection;
    requireValue(selection === 'single' || selection === 'multiple', `Invalid selection mode for ${questionId}`);
    const optionIds = new Set();
    const labels = new Set();
    const options = choices.map((o, j) => {
      const optionId = id(typeof o === 'string' ? `option${j + 1}` : o?.id, 'option id');
      requireValue(!optionIds.has(optionId), `Duplicate option id: ${optionId}`); optionIds.add(optionId);
      const label = string(typeof o === 'string' ? o : o?.label, 'option label');
      requireValue(!labels.has(label.toLowerCase()), `Duplicate option label: ${label}`); labels.add(label.toLowerCase());
      return {id: optionId, label, ...(o.preview !== undefined ? {preview: preview(o.preview)} : {})};
    });
    const context = string(q.context, 'context', true);
    const prompt = string(q.prompt, 'prompt', true);
    requireValue(prompt || context || q.preview, `Provide a prompt, context, or preview for ${questionId}`);
    requireValue(q.required === undefined || typeof q.required === 'boolean', 'Invalid required flag');
    return {id: questionId, number, prompt, context: q.context ?? '', recommendation: string(q.recommendation, 'recommendation', true), selection, options, required: q.required === true, ...(q.preview !== undefined ? {preview: preview(q.preview)} : {})};
  });
  return {title, questions};
}
export function validateAnswers(spec, rawAnswers, {submitted = true} = {}) {
  requireValue(Array.isArray(rawAnswers) && rawAnswers.length === spec.questions.length, 'Submission must include every question exactly once');
  const byId = new Map();
  for (const a of rawAnswers) {
    requireValue(a && typeof a.questionId === 'string' && !byId.has(a.questionId), 'Duplicate or missing answer id');
    byId.set(a.questionId, a);
  }
  const imageIds = new Set();
  function validateNotes(a) {
    string(a.notes, 'notes', true);
    const notes = a.notes ?? '';
    requireValue(a.images === undefined || Array.isArray(a.images), 'Invalid inline images');
    const images = [];
    let end = 0;
    for (const image of a.images ?? []) {
      requireValue(image && Number.isSafeInteger(image.id) && image.id > 0 && !imageIds.has(image.id), 'Invalid or duplicate image id');
      imageIds.add(image.id);
      const token = `[Image #${image.id}]`;
      requireValue(Number.isSafeInteger(image.offset) && image.offset >= end && a.notes?.slice(image.offset, image.offset + token.length) === token, 'Image reference does not match notes');
      end = image.offset + token.length;
      const match = typeof image.dataUrl === 'string' && image.dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
      requireValue(match, 'Invalid image data');
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0)), mimeType = match[1];
      requireValue(btoa(atob(match[2])) === match[2], 'Invalid image encoding');
      const validHeader = mimeType === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
        : mimeType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mimeType === 'image/gif' ? /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0, 6)))
        : String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
      requireValue(validHeader, 'Image data does not match its type');
      images.push({id: image.id, offset: image.offset, mimeType, bytes: bytes.length, dataUrl: image.dataUrl});
    }
    return {notes, ...(images.length ? {images} : {})};
  }
  const answers = spec.questions.map(q => {
    const a = byId.get(q.id);
    const options = q.options.length ? [...q.options, {id: 'other', label: 'Something else'}] : [];
    const allowedIds = new Set(options.map(o => o.id));
    requireValue(a && Array.isArray(a.choiceIds) && new Set(a.choiceIds).size === a.choiceIds.length && a.choiceIds.every(id => allowedIds.has(id)), `Invalid choices for ${q.id}`);
    requireValue(a.selection === undefined || a.selection === q.selection, `Invalid selection mode for ${q.id}`);
    requireValue(q.selection === 'multiple' || a.choiceIds.length <= 1, `Select only one option for ${q.id}`);
    const chosen = new Set(a.choiceIds), selected = options.filter(o => chosen.has(o.id));
    const note = validateNotes(a);
    const allowed = previews(q), states = a.states ?? {}, comments = a.comments ?? [];
    requireValue(states && typeof states === 'object' && !Array.isArray(states) && Object.keys(states).every(key => Object.hasOwn(allowed, key)), 'Invalid preview state target');
    const savedStates = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, snapshot(value)]));
    requireValue(Array.isArray(comments), 'Provide comments as a list');
    const savedComments = comments.map(c => {
      requireValue(c && Object.hasOwn(allowed, c.preview), 'Invalid comment preview');
      // Keep existing named comments readable; new comments select any region.
      requireValue(c.region === undefined ? allowed[c.preview].anchors.includes(c.anchor) : c.anchor === undefined && validRegion(c.region), 'Invalid comment region or anchor');
      return {preview: c.preview, ...(c.region ? {region: JSON.parse(JSON.stringify(c.region))} : {anchor: c.anchor}), state: snapshot(c.state ?? {}), ...validateNotes(c)};
    }).filter(c => !submitted || c.notes.trim());
    const changed = Object.entries(savedStates).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(allowed[key].state));
    const explained = note.notes.trim() || savedComments.some(c => c.notes.trim());
    const responded = selected.length > 0 || explained || changed;
    requireValue(!submitted || !q.required || responded, `Missing answer for ${q.id}`);
    requireValue(!submitted || !chosen.has('other') || explained, `Explain Something else for ${q.id}`);
    return {questionId: q.id, number: q.number, question: q.prompt, selection: q.selection, choiceIds: selected.map(o => o.id), choices: selected.map(o => o.label), ...note, status: responded ? 'feedback' : 'untouched', states: savedStates, comments: savedComments};
  });
  requireValue(!submitted || answers.some(a => a.status === 'feedback'), 'Provide some feedback before submitting');
  return {schemaVersion: VERSION, title: spec.title, answers};
}
