import { Suspense } from "react";
import { CompanyGroupChatDashboard } from "@/components/chat/CompanyGroupChatDashboard";

export default function FounderCompanyChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading company chats...</div>}>
      <CompanyGroupChatDashboard role="founder" />
    </Suspense>
  );
}
