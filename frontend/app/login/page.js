"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { inputCls } from "@/components/ui";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel — hidden on mobile, split-screen from lg up */}
      <div className="hidden lg:block relative lg:w-[55%] xl:w-3/5 bg-[#0d1930]">
        <Image src="/Login.png" alt="" fill priority className="object-contain" sizes="60vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1930] via-[#0d1930]/35 to-[#0d1930]/35" />
        <div className="relative h-full flex flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <div className="gold-gradient w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-lg shadow-black/30">
              <Building size={20} />
            </div>
            <span className="text-white font-bold tracking-wide">Apartment Sales Hub</span>
          </div>
          <div className="max-w-md">
            <h2 className="text-white text-2xl xl:text-3xl font-bold leading-tight">
              Price List, Inventory &amp; Sales
            </h2>
            <p className="text-white/60 text-sm mt-3">
              Track every zone, project and flat with a single, always-accurate source of truth.
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-6 lg:hidden">
            <div className="w-12 h-12 rounded-xl bg-[#1F3864] text-white flex items-center justify-center mx-auto mb-3">
              <Building size={22} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Apartment Sales Hub</h1>
          </div>
          <div className="hidden lg:block mb-6">
            <h1 className="text-xl font-bold text-slate-800">Welcome back</h1>
          </div>
          <p className="text-sm text-slate-400 -mt-4 mb-6 lg:mt-0">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="shadow-premium bg-white rounded-2xl p-6 space-y-4">
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Email</span>
              <input
                type="email"
                required
                autoComplete="username"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@company.com"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold bg-gradient-to-b from-[#28477a] to-[#1F3864] text-white shadow-sm shadow-[#1F3864]/30 hover:shadow-md hover:shadow-[#1F3864]/40 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 px-3.5 py-2.5 text-sm"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-4">
            Demo accounts (password: <code>password</code>): owner@company.com · admin@company.com · rahim@company.com · karim@company.com
          </p>
        </div>
      </div>
    </div>
  );
}
