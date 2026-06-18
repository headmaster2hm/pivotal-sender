"use client";

import { useEffect, useState } from "react";

type DomainStatus = {
  domain?: string;
  sending_ready?: boolean;
  dmarc_verified?: boolean;
  dkim_verified?: boolean;
  spf_verified?: boolean;
  dmarc_record?: {
    name: string;
    type: string;
    value: string;
  } | null;
  message?: string;
  error?: string;
};

export default function DomainHealthBanner() {
  const [status, setStatus] = useState<DomainStatus | null>(null);

  useEffect(() => {
    fetch("/api/domain/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  if (!status || status.sending_ready || status.error) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="font-medium">Email deliverability setup needed</p>
      <p className="mt-1 text-amber-900 dark:text-amber-200">{status.message}</p>

      <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-200">
        <li>DKIM: {status.dkim_verified ? "verified" : "missing or pending"}</li>
        <li>SPF: {status.spf_verified ? "verified" : "missing or pending"}</li>
        <li>DMARC: {status.dmarc_verified ? "verified" : "missing"}</li>
      </ul>

      {status.dmarc_record && (
        <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/70 p-3 font-mono text-xs dark:border-amber-500/20 dark:bg-black/20">
          <p>Add this TXT record in your DNS:</p>
          <p className="mt-2">
            <span className="text-amber-700 dark:text-amber-300">Name:</span>{" "}
            {status.dmarc_record.name}
          </p>
          <p className="mt-1 break-all">
            <span className="text-amber-700 dark:text-amber-300">Value:</span>{" "}
            {status.dmarc_record.value}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs opacity-90">
        Resend may accept emails without DMARC, but Gmail and other providers often
        block or drop them. After adding the record, wait up to 48 hours for DNS
        propagation, then verify in the Resend dashboard.
      </p>
    </div>
  );
}
