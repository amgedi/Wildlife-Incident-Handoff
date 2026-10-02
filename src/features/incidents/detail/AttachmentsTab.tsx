/** Attachments tab: photo previews, captions, removal (metadata + blob), storage honesty. */
import { useEffect, useState } from "react";
import type { Incident } from "../../../types/incident";
import { SectionHeading } from "../../../components/ui";
import { deleteAttachmentBlob, getAttachmentsForIncident } from "../../../storage/repositories";
import { putIncident } from "../../../storage/repositories";
import { useApp } from "../../../app/AppContext";
import { bytesToSize, formatDateTime, nowIso } from "../../../utils/time";
import { Icons } from "../../../components/Icons";
import { Dialog } from "../../../components/Dialog";
import { uuid } from "../../../utils/id";

interface Loaded {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

export function AttachmentsTab({ incident, onChanged }: { incident: Incident; onChanged: () => void }) {
  const { showToast } = useApp();
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [inputRef] = useState(() => ({ current: null as HTMLInputElement | null }));
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    let urls: string[] = [];
    getAttachmentsForIncident(incident.id).then((blobs) => {
      urls = blobs.map((b) => URL.createObjectURL(b.data));
      setLoaded(blobs.map((b, i) => ({ id: b.id, url: urls[i]!, fileName: b.fileName, mimeType: b.mimeType, byteSize: b.byteSize })));
    });
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [incident.id, incident.attachments.length]);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 8)) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) {
        showToast(`${file.name} is not a photo or video and was skipped`);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        showToast(`${file.name} is over 25 MB and was skipped to protect local storage`);
        continue;
      }
      const id = uuid();
      try {
        const { putAttachmentBlob } = await import("../../../storage/repositories");
        await putAttachmentBlob({ id, incidentId: incident.id, fileName: file.name, mimeType: file.type, byteSize: file.size, data: file });
        const { addAttachmentMeta } = await import("./metaHelpers");
        await addAttachmentMeta(incident, {
          id,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
          caption: null,
          addedAt: nowIso(),
          sourceAttribution: null,
          sensitive: false,
          kind: isVideo ? "video" : "photo",
        });
      } catch {
        showToast("We couldn't save this media because browser storage is full. Try exporting a backup, then removing large attachments.");
      }
    }
    showToast("Attachment added");
    onChanged();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(id: string) {
    await deleteAttachmentBlob(id);
    const { removeAttachmentMeta } = await import("./metaHelpers");
    await removeAttachmentMeta(incident, id);
    showToast("Attachment removed");
    setConfirmRemove(null);
    onChanged();
  }

  const totalBytes = loaded.reduce((sum, l) => sum + l.byteSize, 0);

  return (
    <div className="card">
      <SectionHeading help="Photos are stored locally in this browser. They are never analyzed or diagnosed automatically, and are only shared when you explicitly export them.">
        Attachments
      </SectionHeading>
      <p style={{ color: "var(--c-ink-faint)", fontSize: "0.85rem" }}>
        {loaded.length} attachment{loaded.length === 1 ? "" : "s"} · approx. {bytesToSize(totalBytes)} of local storage used
      </p>

      <input
        ref={(el) => { inputRef.current = el; }}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        multiple
        style={{ display: "none" }}
        id="attachments-input"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
        <Icons.camera size={16} /> Add photos or videos
      </button>

      {loaded.length > 0 && (
        <div className="photo-grid" style={{ marginTop: "var(--space-4)" }}>
          {loaded.map((l) => {
            const meta = incident.attachments.find((a) => a.id === l.id);
            const isVideo = (meta?.kind ?? (l.mimeType.startsWith("video/") ? "video" : "photo")) === "video";
            return (
              <div key={l.id} className="photo-card">
                {isVideo ? (
                  // No autoplay — playback only on user action.
                  <video src={l.url} poster={meta?.posterDataUrl} controls muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }} />
                ) : (
                  <img src={l.url} alt={meta?.caption ?? l.fileName} loading="lazy" />
                )}
                {isVideo && <span className="badge" style={{ position: "absolute", top: 6, left: 6 }}>Video{meta?.durationSeconds != null ? ` · ${Math.round(meta.durationSeconds)}s` : ""}</span>}
                <div className="photo-caption">
                  <input
                    className="input"
                    style={{ fontSize: "0.8rem", minHeight: 30 }}
                    placeholder="Caption (optional)"
                    defaultValue={meta?.caption ?? ""}
                    onBlur={async (e) => {
                      if (meta && e.target.value !== meta.caption) {
                        await putIncident({
                          ...incident,
                          attachments: incident.attachments.map((a) => (a.id === l.id ? { ...a, caption: e.target.value || null } : a)),
                        });
                      }
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--c-ink-faint)" }}>
                      {bytesToSize(l.byteSize)} · {meta ? formatDateTime(meta.addedAt) : ""}
                    </span>
                    <button className="btn btn-quiet btn-sm" onClick={() => setConfirmRemove(l.id)} aria-label={`Remove ${l.fileName}`}>
                      <Icons.trash size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={confirmRemove !== null}
        title="Remove attachment?"
        onClose={() => setConfirmRemove(null)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmRemove(null)}>Keep it</button>
            <button className="btn btn-danger" onClick={() => confirmRemove && void remove(confirmRemove)}>Remove</button>
          </>
        }
      >
        <p>This removes the photo from this device. If it might matter later, export a backup first.</p>
      </Dialog>
    </div>
  );
}
