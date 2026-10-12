// Schedule decisions are independent of the agent, shell, clock, and filesystem.
export const pollDelays = [1, 2, 3, 5, 10].flatMap(minutes => Array(minutes).fill(minutes * 60_000));
const offsets = pollDelays.map((_, index) => pollDelays.slice(0, index + 1).reduce((sum, delay) => sum + delay, 0));

export function startPolling(now) {
  return {startedAt: now, checked: 0};
}

export function pollingWindow(progress, now) {
  if (!Number.isSafeInteger(progress?.startedAt) || progress.startedAt < 0 || !Number.isInteger(progress.checked) || progress.checked < 0 || progress.checked > offsets.length) {
    throw new Error('Invalid polling state; use manual collection');
  }
  const expiresAt = progress.startedAt + offsets.at(-1);
  if (progress.checked === offsets.length || now > expiresAt) return null;
  return {dueAt: progress.startedAt + offsets[progress.checked], expiresAt};
}

export function advancePolling(progress, now) {
  let checked = progress.checked + 1;
  // After a suspended process, check once instead of replaying missed checks in a burst.
  while (checked < offsets.length && progress.startedAt + offsets[checked] <= now) checked++;
  return {...progress, checked};
}
