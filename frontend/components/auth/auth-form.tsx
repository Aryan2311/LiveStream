"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { login, register } from "@/lib/api";
import { ApiError } from "@/lib/types";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { setSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await register({
          email,
          password,
          display_name: displayName,
        });
        setSuccess("Account created. Signing you in now.");
      }

      const auth = await login({ email, password });
      setSession(auth);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong while talking to the platform.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel
      title={isRegister ? "Create your channel" : "Welcome back"}
      description={
        isRegister
          ? "Create your account, get signed in automatically, and head straight into Studio to set up your first stream."
          : "Sign in to manage your streams, update your studio, and jump back into live control."
      }
      className="mx-auto max-w-xl"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {isRegister ? (
          <Input
            label="Display name"
            placeholder="What should viewers call you?"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        ) : null}
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error ? <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
        {success ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Working..." : isRegister ? "Create account" : "Sign in"}
          </Button>
          <Link className="text-sm text-slate-300 transition hover:text-white" href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Already have an account?" : "Need an account?"}
          </Link>
        </div>
      </form>
    </Panel>
  );
}
