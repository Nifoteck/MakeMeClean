import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Eye, EyeOff, Mail, ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sendOtp, verifyOtp } from "@/lib/otp";

type Stage = "form" | "verify" | "done";

export default function Register() {
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>("form");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    const result = await sendOtp(email, "registration");
    if (!result.ok) { setError(result.error ?? "Failed to send code"); setLoading(false); return; }
    setStage("verify");
    startCooldown();
    setLoading(false);
  };

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (next.every((d) => d !== "")) {
      verifyCode(next.join(""));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) {
      setOtp(digits.split(""));
      verifyCode(digits);
    }
  };

  const verifyCode = async (code: string) => {
    setVerifying(true);
    setError("");
    const result = await verifyOtp(email, code, "registration");
    if (!result.ok || !result.verified) {
      const msg =
        result.reason === "expired_or_not_found"
          ? "Code expired or not found. Please request a new one."
          : "Incorrect code. Please try again.";
      setError(msg);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setVerifying(false);
      return;
    }
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone }, emailRedirectTo: undefined },
    });
    if (signUpError) { setError(signUpError.message); setVerifying(false); return; }
    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, full_name: fullName, phone });
    }
    setStage("done");
    setVerifying(false);
    setTimeout(() => setLocation("/dashboard"), 2000);
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setError("");
    setOtp(["", "", "", "", "", ""]);
    const result = await sendOtp(email, "registration");
    if (!result.ok) setError(result.error ?? "Failed to resend code");
    else startCooldown();
    setResending(false);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  if (stage === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-500 text-sm">Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-5">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">Make<span className="text-green-600">Me</span>Clean</span>
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900">
            {stage === "form" ? "Create your account" : "Check your email"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {stage === "form"
              ? "Book cleaning services across Wales"
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          {stage === "form" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+44 7700 000000"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="input-field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending code..." : "Continue"}
              </button>
            </form>
          )}

          {stage === "verify" && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center">
                  <Mail className="w-7 h-7 text-green-600" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 text-center mb-4 uppercase tracking-wide">Enter verification code</p>
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpInput(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      disabled={verifying}
                      className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all disabled:opacity-50 bg-white"
                    />
                  ))}
                </div>
                {verifying && (
                  <p className="text-center text-xs text-gray-400 mt-3">Verifying...</p>
                )}
              </div>

              <div className="text-center space-y-2">
                <button
                  onClick={resendCode}
                  disabled={resendCooldown > 0 || resending}
                  className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resending ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
                <br />
                <button
                  onClick={() => { setStage("form"); setError(""); setOtp(["", "", "", "", "", ""]); }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-green-600 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
