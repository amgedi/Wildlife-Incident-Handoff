/** First-run replay/preview state helpers.
 *  Replay: clears the onboarded flag so onboarding shows again (data kept).
 *  Preview: temporarily shows onboarding without touching saved settings —
 *  App.tsx renders onboarding while `onboardingPreviewActive` is true, and
 *  exiting the preview restores the flag without overwriting real settings.
 */

const PREVIEW_KEY = "onboarding-preview-active";

export function resetOnboardingForReplay(): void {
  // Nothing to clear beyond settings.onboarded itself (cleared by the caller).
}

export function beginOnboardingPreview(): void {
  try {
    sessionStorage.setItem(PREVIEW_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

export function endOnboardingPreview(): void {
  try {
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* non-fatal */
  }
}

export function isOnboardingPreviewActive(): boolean {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}
