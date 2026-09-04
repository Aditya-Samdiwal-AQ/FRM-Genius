/**
 * Notify orchestration — Plan.md §7 POST /api/payer-changes/:id/notify.
 *
 * Plain ESM (.mjs). Builds the compliance-reviewed templated message,
 * sends via lib/mailer.mjs (SMTP or mock .eml), persists a Notification
 * record, and appends audit events (materials_attached, path_communicated,
 * resolution_recorded).
 */

import { db, mutateStore, nextId } from "./db.mjs";
import { appendAuditEvents } from "./audit.mjs";
import { sendMail } from "./mailer.mjs";
import { FIELD_LABEL } from "./constants.mjs";

const FRM_NAME = "Jordan Lee";
const FRM_TITLE = "Field Reimbursement Manager";
const TERRITORY = "Territory 14 — Great Lakes";
const PRODUCT = "Onvexa";

/** Escape minimal HTML entities in dynamic values. */
function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Build the templated email (subject + html + text). Mirrors the
 * compliance-reviewed template the UI previews in Step 3.
 */
export function buildMessage({ change, accounts, materials }) {
  const typeLabel = change.change_type_group;
  const fieldLabel = FIELD_LABEL[change.field] ?? change.field;
  const planLabel = change.plan_name;
  const corrected = change.corrected_path_value ?? change.authoritative.value;
  const source = change.corrected_path_source ?? change.authoritative.source;
  const sourceDate = change.authoritative.source_date;
  const effective = change.effective_date;
  const recipientNames = accounts.map((a) => a.name).join(", ");
  const materialTitles = materials.map((m) => m.title);

  const subject = `${PRODUCT} ${typeLabel} Update — Corrected Path`;

  const html = [
    `<p>Dear Office,</p>`,
    `<p>This message confirms an update to the <strong>${esc(typeLabel)}</strong> guidance for <strong>${esc(PRODUCT)}</strong> administered through your plan.</p>`,
    `<div style="border:1px solid #2f3aa0;background:#eef2ff;padding:12px;border-radius:12px;">`,
    `<p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#2f3aa0;">Updated guidance — ${esc(fieldLabel)}</p>`,
    `<p style="margin:4px 0 0;font-weight:700;color:#1f2a7a;">${esc(corrected)}</p>`,
    `<p style="margin:8px 0 0;font-family:monospace;font-size:11px;color:#6b7280;">${esc(source)} · ${esc(sourceDate)} · ${esc(planLabel)}</p>`,
    `<p style="margin:2px 0 0;font-family:monospace;font-size:11px;color:#6b7280;">Effective: ${esc(effective)}</p>`,
    `</div>`,
    `<p>This update reflects the latest authoritative payer policy from <strong>${esc(source)}</strong>, effective <strong>${esc(effective)}</strong>. Please update your office workflows accordingly.</p>`,
    `<p><strong>Attached materials</strong></p>`,
    `<ul>${materialTitles.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`,
    `<p style="border-top:1px solid #e5e7eb;padding-top:8px;"><strong>${esc(FRM_NAME)}</strong> — ${esc(FRM_TITLE)}, Oncology &amp; Rare Disease<br><span style="font-family:monospace;font-size:11px;color:#6b7280;">${esc(TERRITORY)}</span></p>`,
  ].join("\n");

  const text = [
    `Dear Office,`,
    ``,
    `This message confirms an update to the ${typeLabel} guidance for ${PRODUCT} administered through your plan.`,
    ``,
    `Updated guidance (${fieldLabel}): ${corrected}`,
    `Source: ${source} · ${sourceDate} · ${planLabel}`,
    `Effective: ${effective}`,
    ``,
    `Attached materials:`,
    ...materialTitles.map((t) => `  - ${t}`),
    ``,
    `${FRM_NAME} — ${FRM_TITLE}, Oncology & Rare Disease`,
    TERRITORY,
  ].join("\n");

  return {
    subject,
    html,
    text,
    message: {
      to: recipientNames,
      re: subject,
      from: `${FRM_NAME}, FRM · ${TERRITORY}`,
      corrected_path: corrected,
      source,
      effective_date: effective,
      materials: materialTitles,
    },
  };
}

/**
 * Send the notification for a resolved change, persist the Notification
 * record, and append audit events. Runs the whole read-modify-write cycle
 * under the DB write mutex.
 */
export async function sendChangeNotification({ change, accountIds, materialIds }) {
  const accounts = db.accounts().filter((a) => accountIds.includes(a.id));
  const materials = db.materials().filter((m) => materialIds.includes(m.id));

  const { subject, html, text, message } = buildMessage({ change, accounts, materials });
  const notificationId = nextId("ntf");
  const to = accounts.map((a) => a.email).join(", ");

  const { transport, message_id } = await sendMail({
    to,
    subject,
    html,
    text,
    mockId: notificationId,
  });

  const record = {
    id: notificationId,
    payer_change_id: change.id,
    sent_at: new Date().toISOString(),
    sent_by: FRM_NAME,
    recipient_account_ids: accounts.map((a) => a.id),
    recipient_emails: accounts.map((a) => a.email),
    message,
    transport,
    message_id,
  };

  await mutateStore("notifications.json", (current) => [...current, record]);

  await appendAuditEvents([
    {
      payer_change_id: change.id,
      actor: FRM_NAME,
      event_type: "materials_attached",
      description: `${materials.length} compliance-reviewed material${materials.length === 1 ? "" : "s"} attached: ${materialTitles(materials)}`,
    },
    {
      payer_change_id: change.id,
      actor: FRM_NAME,
      event_type: "path_communicated",
      description: `Corrected path communicated to ${accounts.length} office${accounts.length === 1 ? "" : "s"} via email (${transport})`,
    },
    {
      payer_change_id: change.id,
      actor: "System",
      event_type: "resolution_recorded",
      description: `Resolution recorded in audit log for ${change.plan_name}`,
    },
  ]);

  return record;
}

function materialTitles(materials) {
  return materials.map((m) => `"${m.title}"`).join(", ");
}
