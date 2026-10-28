"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Shield, Mail, Lock, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const user = await login(email, password);
      toast.success(`Signed in as ${user.name}`);
      if (returnUrl && !returnUrl.startsWith("/staff")) {
        router.push(returnUrl);
      } else {
        router.push("/report");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to sign in. Verify email and password.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
          Back to public feed
        </Link>

        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-input bg-text text-bg flex items-center justify-center font-bold">
            <Shield className="w-4 h-4 stroke-[1.5]" />
          </div>
          <span className="font-bold text-base text-text">Campus Black Box</span>
        </div>
        <h1 className="text-center text-xl font-bold text-text">Sign in to your account</h1>
        <p className="text-center text-xs text-muted mt-1">
          Role-authenticated access for student reporters, technicians and administrators
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface border border-border rounded-card p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-input">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Account Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted stroke-[1.5]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted stroke-[1.5]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
                  required
                />
              </div>
            </div>

            {/* Seeded Demo Account Quick Selectors */}
            <div className="pt-1">
              <div className="text-[11px] text-muted font-medium mb-1.5">
                Sample data demo accounts (Password: DemoPass123!):
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("student@campus.edu");
                    setPassword("DemoPass123!");
                  }}
                  className="py-1 px-2 rounded border border-border bg-bg text-muted hover:text-text text-left"
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("faculty@campus.edu");
                    setPassword("DemoPass123!");
                  }}
                  className="py-1 px-2 rounded border border-border bg-bg text-muted hover:text-text text-left"
                >
                  Faculty
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-input bg-text text-bg font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign in"}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-border">
            <span className="text-xs text-muted">Don&apos;t have an account? </span>
            <Link href="/register" className="text-xs font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <LoginForm />
    </Suspense>
  );
}
