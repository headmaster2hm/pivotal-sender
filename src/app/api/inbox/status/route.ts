import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";

export async function GET() {
  try {
    const domainName = process.env.ALLOWED_FROM_DOMAIN?.trim().toLowerCase();

    if (!domainName) {
      return NextResponse.json({
        configured: false,
        message: "ALLOWED_FROM_DOMAIN is not configured.",
      });
    }

    const resend = getResendClient();
    const { data, error } = await resend.domains.list();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    const domain = data?.data.find(
      (item) => item.name.toLowerCase() === domainName,
    );

    if (!domain) {
      return NextResponse.json({
        configured: false,
        domain: domainName,
        message: `Domain ${domainName} is not added in Resend.`,
      });
    }

    const { data: details, error: detailsError } = await resend.domains.get(
      domain.id,
    );

    if (detailsError || !details) {
      return NextResponse.json(
        { error: detailsError?.message || "Failed to load domain details" },
        { status: 422 },
      );
    }

    const receivingRecord = details.records.find(
      (record) => record.record === "Receiving",
    );

    const receivingEnabled = details.capabilities.receiving === "enabled";
    const mxVerified = receivingRecord?.status === "verified";

    return NextResponse.json({
      configured: receivingEnabled && mxVerified,
      domain: domainName,
      receiving_enabled: receivingEnabled,
      mx_verified: mxVerified,
      mx_record: receivingRecord
        ? {
            type: receivingRecord.type,
            name: receivingRecord.name || "@",
            value: receivingRecord.value,
            priority: receivingRecord.priority,
            status: receivingRecord.status,
          }
        : null,
      message: !receivingEnabled
        ? "Inbound email is disabled for this domain in Resend."
        : !mxVerified
          ? "Add the inbound MX record to your DNS, then wait for verification."
          : "Inbound email is ready. New messages will appear in the inbox.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check inbox status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
