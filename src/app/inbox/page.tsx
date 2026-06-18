import AppHeader from "@/components/AppHeader";
import Inbox from "@/components/Inbox";

export default function InboxPage() {
  return (
    <div className="page-bg min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <AppHeader
          title="Maildesk"
          subtitle="Inbox for your domain"
          active="inbox"
        />
        <Inbox />
      </div>
    </div>
  );
}
