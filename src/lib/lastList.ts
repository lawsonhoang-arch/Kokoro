// Remembers the list the user last had open, so the "Lists" nav tab can drop
// them back into it instead of the gallery's pick-a-list screen. Client-only
// (localStorage); safe to call anywhere — failures are swallowed.
const KEY = "kokoro:last-list";

export function getLastList(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastList(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore (private mode / disabled storage) */
  }
}

export function clearLastList(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
