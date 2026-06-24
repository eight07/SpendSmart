import { useMemo, useState } from "react";
import { useAuth } from "../context/auth";

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25V6.75Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5.5 7 5.1 4.15a2.25 2.25 0 0 0 2.8 0L18.5 7"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.75 10V7.75a4.25 4.25 0 0 1 8.5 0V10"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 10h10.5A2.75 2.75 0 0 1 20 12.75v4.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25v-4.5A2.75 2.75 0 0 1 6.75 10Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-semibold text-blue-600">
      G
    </span>
  );
}

function AuthInput({ icon, label, error, ...props }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 ${
          error ? "border-red-300" : "border-gray-200"
        }`}
      >
        <span className="text-gray-400">{icon}</span>
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-950 outline-none placeholder:text-gray-400"
          {...props}
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function AuthPage() {
  const { authenticate } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [touched, setTouched] = useState({});

  const errors = useMemo(() => {
    const nextErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (mode === "signup" && form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords must match.";
    }

    return nextErrors;
  }, [form, mode]);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create Account" : "Welcome Back";
  const subtitle = isSignup
    ? "Start tracking your spending in a cleaner, smarter dashboard."
    : "Sign in to continue to your SpendSmart dashboard.";

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function handleBlur(event) {
    setTouched({ ...touched, [event.target.name]: true });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setServerError("");
    setTouched({});
    setForm((current) => ({ ...current, confirmPassword: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ email: true, password: true, confirmPassword: true });
    setServerError("");

    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await authenticate(isSignup ? "signup" : "signin", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-950 text-sm font-black text-white">
              SS
            </div>
            <span className="text-2xl font-semibold tracking-tight text-gray-950">
              SpendSmart
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-950">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-500">{subtitle}</p>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                !isSignup
                  ? "bg-white text-gray-950 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                isSignup
                  ? "bg-white text-gray-950 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Sign Up
            </button>
          </div>

          {serverError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <AuthInput
              icon={<MailIcon />}
              label="Email Address"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="you@example.com"
              autoComplete="email"
              error={touched.email ? errors.email : ""}
            />

            <AuthInput
              icon={<LockIcon />}
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Minimum 8 characters"
              autoComplete={isSignup ? "new-password" : "current-password"}
              error={touched.password ? errors.password : ""}
            />

            {isSignup && (
              <AuthInput
                icon={<LockIcon />}
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Repeat your password"
                autoComplete="new-password"
                error={touched.confirmPassword ? errors.confirmPassword : ""}
              />
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
            >
              {submitting ? "Please wait..." : "Continue"}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm text-gray-500">Or Continue With</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </section>

      <section className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-sky-100 to-blue-300 px-8 py-12 lg:min-h-screen">
        <div className="absolute left-12 top-16 h-24 w-24 rounded-full bg-white/50 blur-2xl" />
        <div className="absolute bottom-20 right-12 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />

        <div className="relative h-72 w-72 sm:h-96 sm:w-96">
          <div className="absolute inset-10 rotate-6 rounded-[3rem] bg-blue-500 shadow-2xl shadow-blue-700/20" />
          <div className="absolute inset-16 -rotate-6 rounded-[2.5rem] bg-sky-300/90 shadow-xl shadow-blue-800/10" />
          <div className="absolute left-1/2 top-1/2 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-2xl">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-3xl font-black text-white shadow-inner">
              $
            </div>
          </div>
          <div className="absolute bottom-14 left-8 rounded-3xl bg-white/80 px-5 py-4 shadow-xl backdrop-blur">
            <p className="text-xs font-medium text-gray-500">Monthly saved</p>
            <p className="mt-1 text-2xl font-semibold text-gray-950">$428</p>
          </div>
          <div className="absolute right-4 top-12 rounded-3xl bg-gray-950 px-5 py-4 text-white shadow-xl">
            <p className="text-xs text-blue-200">Budget health</p>
            <p className="mt-1 text-xl font-semibold">92%</p>
          </div>
        </div>
      </section>
    </main>
  );
}
