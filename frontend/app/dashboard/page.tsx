import { AppNav } from "@/components/app/app-nav";
import { DashboardContent } from "@/components/streams/dashboard-content";
import { Shell } from "@/components/ui/shell";

export default function DashboardPage() {
  return (
    <Shell
      eyebrow="Dashboard"
      title="Keep track of your streams at a glance."
      description="See what is live, what is scheduled next, and where to jump back into Studio."
    >
      <div className="space-y-6">
        <AppNav />
        <DashboardContent />
      </div>
    </Shell>
  );
}
