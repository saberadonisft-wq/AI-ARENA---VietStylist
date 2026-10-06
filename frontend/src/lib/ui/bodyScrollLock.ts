type ScrollLock = { count: number; previousOverflow: string };

const locks = new WeakMap<HTMLElement, ScrollLock>();

/** Keep the page locked until every overlapping dialog has released its lock. */
export function lockBodyScroll(body: HTMLElement = document.body): () => void {
  let lock = locks.get(body);
  if (!lock) {
    lock = { count: 0, previousOverflow: body.style.overflow };
    locks.set(body, lock);
    body.style.overflow = "hidden";
  }
  lock.count++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count--;
    if (lock.count === 0) {
      body.style.overflow = lock.previousOverflow;
      locks.delete(body);
    }
  };
}
