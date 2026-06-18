import { NextRequest, NextResponse } from "next/server";
import {
  formatFromAddress,
  isValidEmail,
  matchesAllowedDomain,
  matchesAllowedDomainList,
  parseEmailAddress,
  validateFromDomain,
} from "@/lib/email-utils";
import { replySubject } from "@/lib/inbox";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthorizedEmail(id: string) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.receiving.get(id);

  if (error) {
    return { error: error.message, status: 422 as const };
  }

  if (!data) {
    return { error: "Email not found", status: 404 as const };
  }

  const allowedDomain = process.env.ALLOWED_FROM_DOMAIN?.trim() || "";
  if (!matchesAllowedDomainList(data.to, allowedDomain)) {
    return { error: "Email not found", status: 404 as const };
  }

  return { email: data };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getAuthorizedEmail(id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ email: result.email });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getAuthorizedEmail(id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Message removed from inbox",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getAuthorizedEmail(id);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    const original = result.email;
    const body = await request.json();
    const { html, text } = body as { html?: string; text?: string };

    if (!html?.trim()) {
      return NextResponse.json(
        { error: "Reply message is required" },
        { status: 400 },
      );
    }

    const allowedDomain = process.env.ALLOWED_FROM_DOMAIN?.trim() || "";
    const defaultFrom =
      process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL?.trim() ||
      `contact@${allowedDomain}`;

    const fromEmail =
      original.to.find((address) => matchesAllowedDomain(address, allowedDomain))
        ? parseEmailAddress(
            original.to.find((address) =>
              matchesAllowedDomain(address, allowedDomain),
            )!,
          )
        : defaultFrom;

    const fromDomainError = validateFromDomain(fromEmail, allowedDomain);
    if (fromDomainError) {
      return NextResponse.json({ error: fromDomainError }, { status: 400 });
    }

    const toEmail = parseEmailAddress(original.from);
    if (!isValidEmail(toEmail)) {
      return NextResponse.json(
        { error: "Cannot reply: invalid sender address" },
        { status: 400 },
      );
    }

    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: replySubject(original.subject),
      html,
      text: text?.trim() || undefined,
      headers: {
        "In-Reply-To": original.message_id,
        References: original.message_id,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      id: data?.id,
      message: "Reply sent successfully",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send reply";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
