"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Shield, Mail, Lock, User, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("reporter");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password, role);
      toast.success("Account registered");
      router.push("/");
    } catch {
      toast.error("Failed to register");
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
          Back to incidents
        </Link>

        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-input bg-text text-bg flex items-center justify-center font-bold">
            <Shield className="w-4 h-4 stroke-[1.5]" />
          </div>
          <span className="font-bold text-base text-text">Campus Black Box</span>
        </div>
        <h1 className="text-center text-xl font-bold text-text">Create an account</h1>
        <p className="text-center text-xs text-muted mt-1">
          Register to report and track campus incidents
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface border border-border rounded-card p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted stroke-[1.5]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Student / Faculty"
                  className="w-full h-10 pl-9 pr-3 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
                  required
                />
              </div>
            </div>

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

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-10 px-3 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
              >
                <option value="reporter">Reporter (Student / Faculty / Technician)</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-input bg-text text-bg font-semibold text-xs hover:opacity-90 transition-opacity"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-border">
            <span className="text-xs text-muted">Already have an account? </span>
            <Link href="/login" className="text-xs font-semibold text-accent hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
