import { NextRequest, NextResponse } from "next/server";
import {
  formatFromAddress,
  isValidEmail,
  parseEmailList,
  validateFromDomain,
} from "@/lib/email-utils";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";

type AttachmentPayload = {
  filename: string;
  content: string;
  contentType?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      fromEmail,
      fromName,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      html,
      text,
      scheduledAt,
      attachments = [],
    } = body as {
      fromEmail: string;
      fromName?: string;
      to: string;
      cc?: string;
      bcc?: string;
      replyTo?: string;
      subject: string;
      html: string;
      text?: string;
      scheduledAt?: string;
      attachments?: AttachmentPayload[];
    };

    if (!fromEmail?.trim()) {
      return NextResponse.json(
        { error: "From email is required" },
        { status: 400 },
      );
    }

    if (!isValidEmail(fromEmail.trim())) {
      return NextResponse.json(
        { error: "From email address is invalid" },
        { status: 400 },
      );
    }

    const allowedFromDomain = process.env.ALLOWED_FROM_DOMAIN?.trim() || "";
    const fromDomainError = validateFromDomain(fromEmail, allowedFromDomain);
    if (fromDomainError) {
      return NextResponse.json({ error: fromDomainError }, { status: 400 });
    }

    const toList = parseEmailList(to || "");
    if (toList.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 },
      );
    }

    if (!subject?.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }

    if (!html?.trim()) {
      return NextResponse.json(
        { error: "Email body is required" },
        { status: 400 },
      );
    }

    const invalidTo = toList.filter((email) => !isValidEmail(email));
    if (invalidTo.length > 0) {
      return NextResponse.json(
        { error: `Invalid recipient: ${invalidTo.join(", ")}` },
        { status: 400 },
      );
    }

    const ccList = parseEmailList(cc || "");
    const bccList = parseEmailList(bcc || "");
    const replyToList = parseEmailList(replyTo || "");

    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: formatFromAddress(fromName || "", fromEmail),
      to: toList,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      replyTo: replyToList.length > 0 ? replyToList : undefined,
      subject: subject.trim(),
      html,
      text: text?.trim() || undefined,
      scheduledAt: scheduledAt?.trim() || undefined,
      attachments:
        attachments.length > 0
          ? attachments.map((file) => ({
              filename: file.filename,
              content: file.content,
              contentType: file.contentType,
            }))
          : undefined,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      id: data?.id,
      message: scheduledAt
        ? "Email scheduled successfully"
        : "Email sent successfully",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
