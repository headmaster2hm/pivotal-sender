import AppHeader from "@/components/AppHeader";
import EmailComposer from "@/components/EmailComposer";

export default function Home() {
  return (
    <div className="page-bg min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <AppHeader
          title="Maildesk"
          subtitle="Compose and send with Resend"
          active="compose"
        />
        <EmailComposer />
      </div>
    </div>
  );
}
