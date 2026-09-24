/** Build the link for the site the user is actually visiting. */
export function shareUrlForOrigin(token: string, origin: string): string {
  return new URL(`/chia-se/${encodeURIComponent(token)}`, origin).href;
}
