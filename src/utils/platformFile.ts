/**
 * Platform file bridge.
 *
 * In the browser/PWA, files download via object URLs (unchanged behavior).
 * In the Tauri desktop shell, we use the native Windows save dialog and
 * write directly to the chosen path — no browser download UI needed.
 */

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

interface TauriApi {
  dialog?: { save?: (opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null> };
  fs?: { writeFile?: (path: string, data: Uint8Array) => Promise<void> };
}

function tauriApi(): TauriApi | null {
  const t = (window as unknown as { __TAURI__?: TauriApi }).__TAURI__;
  return t && t.dialog && t.fs ? t : null;
}

/** Save a Blob or text to a user-chosen path. Returns "saved" | "cancelled" | "browser". */
export async function saveFile(payload: Blob | string, defaultName: string, extension: string): Promise<"saved" | "cancelled" | "browser"> {
  const t = tauriApi();
  if (t && t.dialog?.save && t.fs?.writeFile) {
    const path = await t.dialog.save({
      defaultPath: defaultName,
      filters: [{ name: extension.toUpperCase().slice(1) + " file", extensions: [extension.replace(".", "")] }],
    });
    if (!path) return "cancelled";
    const bytes =
      payload instanceof Blob
        ? new Uint8Array(await payload.arrayBuffer())
        : new TextEncoder().encode(payload);
    await t.fs.writeFile(path, bytes);
    return "saved";
  }
  return "browser";
}
