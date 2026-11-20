// Simplify is a modified version of Spicy Lyrics (https://github.com/Spikerko/spicy-lyrics),
// shared under the same AGPL-3.0 license. This file holds what makes it a separate
// extension: its name, where to report problems, and the switches for the parts of
// the original that only make sense for the original (update prompts, remote settings).

export const SIMPLIFY_NAME = "Simplify";
export const SIMPLIFY_REPO_URL = "https://github.com/glicheee/simplify";
export const SIMPLIFY_ISSUES_URL = `${SIMPLIFY_REPO_URL}/issues`;
export const ORIGINAL_REPO_URL = "https://github.com/Spikerko/spicy-lyrics";

/**
 * Sent with every request to the lyrics service, so the service can tell Simplify
 * apart from the original extension instead of mistaking one for the other.
 */
export const SIMPLIFY_CLIENT_HEADER = { "Simplify-Client": SIMPLIFY_REPO_URL } as const;

/** The original's style element id. Seeing it means Spicy Lyrics itself is also installed. */
const ORIGINAL_STYLE_ID = "slstyles";
export const originalIsRunning = () => !!document.getElementById(ORIGINAL_STYLE_ID);
