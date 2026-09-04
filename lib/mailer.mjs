/**
 * Email transport — Plan.md §4.8, §7.
 *
 * Plain ESM (.mjs). Uses Nodemailer SMTP when SMTP_HOST is configured;
 * otherwise a mock transport writes the RFC-822 message to
 * `data/outbox/<id>.eml` and reports transport "mock". The API returns the
 * same success payload either way so the demo never breaks.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";

const DATA_DIR = join(process.cwd(), "data");
const OUTBOX_DIR = join(DATA_DIR, "outbox");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "frm-genius@example.com";

export function smtpConfigured() {
  return Boolean(SMTP_HOST);
}

/** Build the RFC-822 message (used by both transports). */
export function buildMimeMessage({ to, subject, html, text }) {
  const lines = [
    `From: ${SMTP_FROM}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: text/html; charset="utf-8"`,
    "",
    html,
  ];
  if (text) {
    // Naive multipart alternative so the .eml is readable in plain text too.
    const boundary = "frm-genius-boundary-" + Math.random().toString(36).slice(2);
    return [
      `From: ${SMTP_FROM}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      text,
      `--${boundary}`,
      'Content-Type: text/html; charset="utf-8"',
      "",
      html,
      `--${boundary}--`,
      "",
    ].join("\n");
  }
  return lines.join("\n");
}

/**
 * Send (or mock-send) one message.
 * Returns { transport: "smtp" | "mock", message_id }.
 */
export async function sendMail({ to, subject, html, text, mockId }) {
  if (smtpConfigured()) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ?? 587,
      secure: (SMTP_PORT ?? 587) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    return { transport: "smtp", message_id: info.messageId ?? mockId };
  }

  // Mock transport — write .eml to data/outbox/.
  mkdirSync(OUTBOX_DIR, { recursive: true });
  const mime = buildMimeMessage({ to, subject, html, text });
  const safeId = String(mockId).replace(/[^a-zA-Z0-9_-]/g, "_");
  writeFileSync(join(OUTBOX_DIR, `${safeId}.eml`), mime, "utf8");
  return { transport: "mock", message_id: mockId };
}
