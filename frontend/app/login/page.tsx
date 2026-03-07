import { AuthForm } from "@/components/auth/auth-form";
import { AppNav } from "@/components/app/app-nav";
import { Shell } from "@/components/ui/shell";

export default function LoginPage() {
  return (
    <Shell
      eyebrow="Sign in"
      title="Jump back into your channel."
      description="Manage your streams, update your studio, and get ready to go live."
    >
      <div className="space-y-6">
        <AppNav />
        <AuthForm mode="login" />
      </div>
    </Shell>
  );
}
