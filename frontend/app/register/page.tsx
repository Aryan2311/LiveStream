import { AuthForm } from "@/components/auth/auth-form";
import { AppNav } from "@/components/app/app-nav";
import { Shell } from "@/components/ui/shell";

export default function RegisterPage() {
  return (
    <Shell
      eyebrow="Create account"
      title="Start your channel in minutes."
      description="Create an account, personalize your profile, and head straight into Studio to prepare your first live stream."
    >
      <div className="space-y-6">
        <AppNav />
        <AuthForm mode="register" />
      </div>
    </Shell>
  );
}
