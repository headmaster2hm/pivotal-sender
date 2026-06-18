import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";

function buildDmarcRecord(domain: string, reportEmail: string) {
  return {
    name: "_dmarc",
    type: "TXT",
    value: `v=DMARC1; p=none; rua=mailto:${reportEmail};`,
  };
}

export async function GET() {
  try {
    const domainName = process.env.ALLOWED_FROM_DOMAIN?.trim().toLowerCase();
    const reportEmail =
      process.env.NEXT_PUBLIC_DEFAULT_FROM_EMAIL?.trim() ||
      (domainName ? `contactus@${domainName}` : "");

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

    const dmarcRecord = details.records.find(
      (record) =>
        record.record?.toLowerCase() === "dmarc" ||
        record.name === "_dmarc" ||
        record.name?.startsWith("_dmarc."),
    );

    const dkimRecord = details.records.find(
      (record) => record.record === "DKIM",
    );
    const spfRecord = details.records.find((record) => record.record === "SPF");

    const dmarcVerified = dmarcRecord?.status === "verified";
    const dkimVerified = dkimRecord?.status === "verified";
    const spfVerified = spfRecord?.status === "verified";
    const sendingReady =
      details.capabilities.sending === "enabled" &&
      dkimVerified &&
      spfVerified &&
      dmarcVerified;

    return NextResponse.json({
      domain: domainName,
      sending_enabled: details.capabilities.sending === "enabled",
      dkim_verified: dkimVerified,
      spf_verified: spfVerified,
      dmarc_verified: dmarcVerified,
      sending_ready: sendingReady,
      dmarc_record: dmarcVerified
        ? null
        : buildDmarcRecord(domainName, reportEmail),
      message: !dmarcVerified
        ? "Add a DMARC TXT record to improve deliverability with Gmail, Yahoo, and Microsoft."
        : !dkimVerified || !spfVerified
          ? "Verify DKIM and SPF records in your DNS."
          : "Domain authentication looks good for sending.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check domain status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
