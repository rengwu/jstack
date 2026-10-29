import {validateAnswers, IMAGE_EXTENSIONS} from './model.mjs';

export const SCHEMA = 'grill-form/v2';
const notesIn = answers => answers.flatMap(a => [a, ...(a.comments ?? [])]);

// Fungi binds each draft to its original input. Keep the question IDs as a
// cheap schema check; do not introduce another session store or identity.
export function snapshot(spec, answers, limits, submitted = false) {
  const copy = validateAnswers(spec, answers, {submitted}).answers;
  const attachments = [];
  for (const note of notesIn(copy)) {
    for (const image of note.images ?? []) {
      const match = image.dataUrl?.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match) throw new Error('An inline image is not ready.');
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      if (bytes.length > limits.artifactBytes) throw new Error('An image exceeds Fungi’s file limit.');
      const key = 'image-' + image.id;
      attachments.push({key, name: key + '.' + IMAGE_EXTENSIONS[match[1]], blob: new Blob([bytes], {type: match[1]})});
      delete image.dataUrl;
      image.artifact = key;
      image.mimeType = match[1];
    }
  }
  if (new Set(attachments.map(a => a.key)).size !== attachments.length) throw new Error('Duplicate image reference.');
  if (attachments.reduce((n, a) => n + a.blob.size, 0) > limits.totalArtifactBytes) throw new Error('Images exceed Fungi’s session limit.');
  const data = {schema: SCHEMA, title: spec.title, answers: copy};
  // Leave room for the protocol envelope; Fungi remains the final authority.
  if (new TextEncoder().encode(JSON.stringify(data)).length + 4096 > limits.jsonBytes) {
    throw new Error('Feedback is too large for Fungi. Shorten it or split the review into smaller rounds.');
  }
  return {data, attachments};
}

export async function restoreDraft(draft, attachments, spec) {
  if (draft == null) return null;
  if (![SCHEMA, 'grill-form/v1'].includes(draft.schema) || draft.title !== spec.title || !Array.isArray(draft.answers) ||
      draft.answers.length !== spec.questions.length || draft.answers.some((a, i) => a?.questionId !== spec.questions[i].id)) {
    throw new Error('Saved draft uses a different questionnaire format. Preserve the session for recovery.');
  }
  const restored = structuredClone(draft.answers);
  if (draft.schema === 'grill-form/v1') {
    for (const [i, answer] of restored.entries()) {
      if (spec.questions[i].selection !== 'single' || (answer.choiceId !== null && typeof answer.choiceId !== 'string') || answer.choiceIds !== undefined) {
        throw new Error('Saved single-choice draft does not match this questionnaire. Preserve the session for recovery.');
      }
      answer.choiceIds = answer.choiceId === null ? [] : [answer.choiceId];
      delete answer.choiceId;
      delete answer.choice;
    }
  }
  const files = new Map(attachments.map(a => [a.key, a.blob]));
  for (const note of notesIn(restored)) {
    for (const image of note.images ?? []) {
      const blob = files.get(image.artifact);
      if (!blob) throw new Error('A saved inline image is missing. Preserve the session for recovery.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      image.dataUrl = 'data:' + image.mimeType + ';base64,' + btoa(binary);
      delete image.artifact;
      delete image.mimeType;
    }
  }
  return validateAnswers(spec, restored, {submitted: false}).answers;
}
