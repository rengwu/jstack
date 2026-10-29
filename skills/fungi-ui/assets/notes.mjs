import {element,escapeHTML} from './dom.mjs';
export function createNotes({values,limits,onChange:onUpdate=()=>{},sessionId=crypto.randomUUID()}){
// Inline image editing for the offline form. The browser owns text editing and
// undo; image bytes stay outside the editable DOM and travel in the answer JSON.
const imageAssets = new Map();
let nextImageId = 1;
let previewDialog;
const imageToken = id => `[Image #${id}]`;
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
function readNotes(root) {
 const result = {notes: '', images: []};
 function visit(parent) {
  [...parent.childNodes].forEach((node, i, siblings) => {
   const block = node.nodeType === 1 && /^(DIV|P)$/.test(node.tagName);
   const previousBlock = i > 0 && /^(DIV|P)$/.test(siblings[i-1].nodeName);
   if (i > 0 && (block || previousBlock)) result.notes += '\n';
   if (node.nodeType === 3) result.notes += node.textContent;
   else if (node.nodeType === 1) {
    const id = Number(node.dataset.imageId);
    if (node.classList.contains('image-chip') && imageAssets.has(id)) {
     result.images.push({id, offset: result.notes.length, dataUrl: imageAssets.get(id).dataUrl});
     result.notes += imageToken(id);
    } else if (node.tagName === 'BR') {
     // A final BR is the browser's caret placeholder, not a second newline.
     if (i < siblings.length - 1) result.notes += '\n';
    } else visit(node);
   }
  });
 }
 visit(root);
 return result;
}
function imageChip(id) {
 const chip = element('span', imageToken(id), 'image-chip');
 chip.contentEditable = 'false'; chip.dataset.imageId = id; chip.tabIndex = 0;
 chip.setAttribute('role', 'button'); chip.setAttribute('aria-label', 'Preview Image #'+id);
 chip.title = 'Preview Image #'+id;
 return chip;
}
function notesFragment(answer) {
 const fragment = document.createDocumentFragment();
 let offset = 0;
 for (const image of answer.images ?? []) {
  fragment.append(document.createTextNode(answer.notes.slice(offset, image.offset)), imageChip(image.id));
  offset = image.offset + imageToken(image.id).length;
 }
 fragment.append(document.createTextNode(answer.notes.slice(offset)));
 return fragment;
}
function restoreImages() {
 for (const answer of allNotes()) {
  let end = 0;
  if (!Array.isArray(answer.images ?? [])) throw new Error('Invalid draft images');
  for (const image of answer.images ?? []) {
   if (!Number.isSafeInteger(image.id) || image.id < 1 || image.id > 1_000_000 || imageAssets.has(image.id) ||
       !Number.isSafeInteger(image.offset) || image.offset < end || answer.notes.slice(image.offset, image.offset + imageToken(image.id).length) !== imageToken(image.id) ||
       typeof image.dataUrl !== 'string' || !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl)) throw new Error('Invalid draft image');
   const base64 = image.dataUrl.split(',')[1], bytes = atob(base64).length;
   if (bytes > limits.fileBytes) throw new Error('Draft image too large');
   imageAssets.set(image.id, {dataUrl: image.dataUrl, bytes});
   nextImageId = Math.max(nextImageId, image.id + 1);
   end = image.offset + imageToken(image.id).length;
  }
 }
 if (imageAssets.size > limits.count || [...imageAssets.values()].reduce((sum, image) => sum + image.bytes, 0) > limits.totalBytes) throw new Error('Draft images too large');
}
function previewImage(id) {
 const asset = imageAssets.get(id);
 if (!asset?.dataUrl) return;
 if (!previewDialog) {
  previewDialog = element('dialog', undefined, 'image-preview');
  const heading = element('h2'); heading.id = 'image-preview-title';
  previewDialog.setAttribute('aria-labelledby', heading.id);
  const close = element('button', 'Close preview'); close.type = 'button';
  close.addEventListener('click', () => previewDialog.close());
  previewDialog.append(heading, element('img'), close); document.body.append(previewDialog);
 }
 previewDialog.querySelector('h2').textContent = imageToken(id);
 const img = previewDialog.querySelector('img'); img.src = asset.dataUrl; img.alt = 'Image #'+id;
 previewDialog.showModal();
}
function notesReady() {
 return allNotes().every(answer => answer.notes.length <= 12000 && (answer.images ?? []).every(image => !!image.dataUrl));
}
const allNotes=values;
function createEditor({id=crypto.randomUUID(),label='Notes',value:answer,onChange=()=>{}}) {
 let disposed = false;
 const notes = element('div', undefined, 'notes-editor'); notes.id = id;
 notes.contentEditable = 'true'; notes.setAttribute('role', 'textbox'); notes.setAttribute('aria-multiline', 'true');
 notes.setAttribute('aria-label', label);
 notes.append(notesFragment(answer));
 const error = element('p', '', 'error'); error.hidden = true; error.id = notes.id+'-error'; error.setAttribute('role', 'status');
 notes.setAttribute('aria-describedby', error.id);
 function warn(text) { error.textContent = text; error.hidden = !text; }
 function moveCaretOutsideChip() {
  const selection = getSelection();
  if (!selection.isCollapsed || !selection.focusNode) return;
  const node = selection.focusNode.nodeType === 3 ? selection.focusNode.parentElement : selection.focusNode;
  const chip = node.closest?.('.image-chip');
  if (chip && notes.contains(chip)) {
   const range = document.createRange(); range.setStartAfter(chip); range.collapse(true);
   selection.removeAllRanges(); selection.addRange(range);
  }
 }
 function sync() {
  if(disposed)return;
  // Redo may recreate nodes without the attributes applied after insertion.
  notes.querySelectorAll('.image-chip').forEach(chip => { chip.contentEditable = 'false'; });
  moveCaretOutsideChip();
  Object.assign(answer, readNotes(notes));
  const failed = answer.images.some(image => imageAssets.get(image.id)?.failed);
  const pending = answer.images.some(image => !image.dataUrl);
  const tooLong = answer.notes.length > 12000;
  notes.setAttribute('aria-invalid', String(tooLong || failed));
  warn(tooLong ? 'Keep notes within 12,000 characters.' : failed ? 'An image could not be read. Delete its chip and paste it again.' : pending ? 'Reading image…' : '');
  onUpdate(); onChange();
 }
 // Editing commands preserve native undo, including image insertion/deletion.
 function insertHTML(html) {
  // Chromium can move an already noneditable fragment outside its current line.
  // Make chips atomic after insertion, retaining the inserted nodes for undo.
  if (!document.execCommand('insertHTML', false, html.replaceAll('contenteditable="false"', 'contenteditable="true"'))) { warn('This browser could not insert the clipboard content.'); return false; }
  sync(); return true;
 }
 function selectChip(chip) {
  const range = document.createRange(); range.selectNode(chip);
  const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
 }
 notes.addEventListener('input', sync);
 notes.addEventListener('click', event => {
  const chip = event.target.closest('.image-chip'); if (chip) previewImage(Number(chip.dataset.imageId));
 });
 notes.addEventListener('keydown', event => {
  const focused = event.target.closest('.image-chip');
  if (focused && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); previewImage(Number(focused.dataset.imageId)); return; }
  if (!['Backspace', 'Delete'].includes(event.key) || event.isComposing) return;
  const selection = getSelection();
  if (focused) { event.preventDefault(); notes.focus(); selectChip(focused); document.execCommand('delete'); sync(); return; }
  if (!selection.rangeCount || !selection.isCollapsed) return;
  const range = selection.getRangeAt(0), backward = event.key === 'Backspace';
  let node = range.startContainer, offset = range.startOffset;
  if (node.nodeType === 3) {
   if (backward ? offset > 0 : offset < node.length) return;
  } else {
   const child = node.childNodes[backward ? offset-1 : offset];
   if (child) node = child;
   else if (node === notes) return;
  }
  // Look across empty text nodes at the caret without crossing a line boundary.
  while (node !== notes && !(node.nodeType === 1 && node.classList.contains('image-chip'))) {
   if (node.nodeType === 3 && node !== range.startContainer && node.length) return;
   if (node.nodeType === 1) return;
   node = backward ? node.previousSibling : node.nextSibling;
   if (!node) return;
  }
  if (node !== notes && node?.classList?.contains('image-chip')) {
   event.preventDefault(); selectChip(node); document.execCommand('delete'); sync();
  }
 });
 notes.addEventListener('paste', event => {
  const clipboard = event.clipboardData; if (!clipboard) return;
  event.preventDefault();
  const files = [...clipboard.items].filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
  const active = allNotes().flatMap(answer => answer.images ?? []);
  function fits(incoming) {
   if (active.length + incoming.length > limits.count || active.reduce((sum, image) => sum + imageAssets.get(image.id).bytes, 0) + incoming.reduce((sum, image) => sum + image.bytes, 0) > limits.totalBytes) {
    warn('Images exceed this interface’s count or size limit.'); return false;
   }
   return true;
  }
  if (files.length) {
   if (files.some(file => !imageTypes.has(file.type))) { warn('Paste a PNG, JPEG, GIF, or WebP image.'); return; }
   if (files.some(file => file.size > limits.fileBytes)) { warn('An image exceeds this interface’s file limit.'); return; }
   if (!fits(files.map(file => ({bytes: file.size})))) return;
   const pending = files.map(file => {
    const id = nextImageId++; imageAssets.set(id, {bytes: file.size}); return {id, file};
   });
   // Insert immediately so an asynchronous read cannot move the paste to a new caret.
   if (!insertHTML(pending.map(({id}) => imageChip(id).outerHTML).join(''))) return;
   for (const {id, file} of pending) {
    const reader = new FileReader();
    reader.onload = () => {
     const img = new Image();
     img.onload = () => { imageAssets.get(id).dataUrl = reader.result; sync(); };
     img.onerror = () => { imageAssets.get(id).failed = true; sync(); };
     img.src = reader.result;
    };
    reader.onerror = () => { imageAssets.get(id).failed = true; sync(); };
    reader.readAsDataURL(file);
   }
   return;
  }
  // Keep references when moving/copying text within this form. External text
  // that happens to contain "[Image #1]" remains ordinary text.
  try {
   const copied = JSON.parse(clipboard.getData('application/x-fungi-ui-notes'));
   if (copied.sessionId === sessionId && typeof copied.notes === 'string' && copied.notes.length <= 12000 && Array.isArray(copied.images) && copied.images.length) {
    let end = 0;
    const valid = copied.images.every(image => {
     const token = imageToken(image.id);
     if (!imageAssets.get(image.id)?.dataUrl || !Number.isSafeInteger(image.offset) || image.offset < end || copied.notes.slice(image.offset, image.offset + token.length) !== token) return false;
     end = image.offset + token.length; return true;
    });
    if (valid) {
     if (!fits(copied.images.map(image => imageAssets.get(image.id)))) return;
     let html = '', offset = 0;
     for (const image of copied.images) {
      const id = nextImageId++; imageAssets.set(id, imageAssets.get(image.id));
      html += escapeHTML(copied.notes.slice(offset, image.offset)) + imageChip(id).outerHTML;
      offset = image.offset + imageToken(image.id).length;
     }
     insertHTML(html + escapeHTML(copied.notes.slice(offset))); return;
    }
   }
  } catch {} // Other applications supply plain text or ordinary image files.
  // Only plain text enters from external rich-text clipboard content.
  const text = clipboard.getData('text/plain');
  if (text) { document.execCommand('insertText', false, text); sync(); }
 });
 for (const type of ['copy', 'cut']) notes.addEventListener(type, event => {
  const selection = getSelection();
  if (!event.clipboardData || !selection.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  if (!notes.contains(range.startContainer) || !notes.contains(range.endContainer)) return;
  const copied = readNotes(range.cloneContents());
  event.clipboardData.setData('text/plain', copied.notes);
  event.clipboardData.setData('application/x-fungi-ui-notes', JSON.stringify({sessionId: sessionId, notes: copied.notes, images: copied.images.map(({id, offset}) => ({id, offset}))}));
  event.preventDefault();
  if (type === 'cut') { document.execCommand('delete'); sync(); }
 });
 // Native rich-text drops could insert untracked images or formatting.
 notes.addEventListener('drop', event => event.preventDefault());
 notes.addEventListener('beforeinput', event => { if (event.inputType.startsWith('format')) event.preventDefault(); });
 return {notes, error, dispose(){disposed=true}};
}


restoreImages();
return {createEditor,ready:notesReady,fragment:notesFragment,previewImage,read:readNotes};
}
