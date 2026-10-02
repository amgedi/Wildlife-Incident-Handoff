/** Small helpers shared by tabs for incident mutations that also log events. */
import type { AttachmentMeta, Incident } from "../../../types/incident";
import { putIncident } from "../../../storage/repositories";
import { randomId } from "../../../utils/id";
import { nowIso } from "../../../utils/time";
import type { TimelineEvent } from "../../../types/incident";

export async function addAttachmentMeta(incident: Incident, meta: AttachmentMeta): Promise<void> {
  const event: TimelineEvent = {
    eventId: randomId(),
    incidentId: incident.id,
    eventType: "photo_added",
    timestamp: nowIso(),
    actor: null,
    summary: `Photo added: ${meta.fileName}`,
    details: meta.caption,
    metadata: null,
    relatedAttachmentIds: [meta.id],
  };
  await putIncident({
    ...incident,
    attachments: [...incident.attachments, meta],
    timeline: [...incident.timeline, event],
  });
}

export async function removeAttachmentMeta(incident: Incident, attachmentId: string): Promise<void> {
  const meta = incident.attachments.find((a) => a.id === attachmentId);
  const event: TimelineEvent = {
    eventId: randomId(),
    incidentId: incident.id,
    eventType: "attachment_removed",
    timestamp: nowIso(),
    actor: null,
    summary: `Attachment removed${meta ? `: ${meta.fileName}` : ""}`,
    details: null,
    metadata: null,
    relatedAttachmentIds: [],
  };
  await putIncident({
    ...incident,
    attachments: incident.attachments.filter((a) => a.id !== attachmentId),
    timeline: [...incident.timeline, event],
  });
}
