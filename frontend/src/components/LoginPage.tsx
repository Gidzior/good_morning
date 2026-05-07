export default function LoginPage() {
  return (
    <div className="min-h-screen grid bg-background lg:grid-cols-[minmax(420px,1fr)_1.2fr]">
      <div className="flex flex-col justify-center px-8 py-14 sm:px-12 lg:px-16 lg:py-14 max-w-[520px] w-full mx-auto lg:mx-0">
        <div className="flex items-center gap-2.5 mb-16">
          <div className="w-3.5 h-3.5 rounded-[3px] bg-[color:var(--ink)]" />
          <span className="font-serif text-[18px] tracking-[-0.01em] text-[color:var(--ink)]">
            dashboard
          </span>
        </div>

        <h1 className="font-serif font-medium text-[40px] leading-[1.1] tracking-[-0.02em] text-[color:var(--ink)] mb-4 text-pretty">
          Twój dzień, w jednym miejscu.
        </h1>

        <p className="text-[15px] leading-[1.55] text-[color:var(--ink-2)] mb-8 text-pretty">
          Pogoda, wiadomości, zadania, rynki — bez zbędnego szumu. Zaloguj się, aby kontynuować.
        </p>

        <a
          href="/auth/google"
          className="inline-flex items-center gap-3 self-start px-[18px] py-3 bg-[color:var(--surface)] border border-[color:var(--line-strong)] rounded-[10px] text-sm font-medium text-[color:var(--ink)] shadow-[var(--shadow-1)] transition-[transform,box-shadow] duration-150 hover:-translate-y-[1px] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)]"
        >
          <GoogleG />
          <span>Zaloguj się przez Google</span>
        </a>

        <div className="mt-6 text-xs text-[color:var(--ink-3)]">
          Kontynuując, akceptujesz <u>Warunki</u> i <u>Politykę prywatności</u>.
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden lg:flex flex-col p-14 border-l border-[color:var(--line)] bg-[#F4F2EC] relative overflow-hidden"
      >
        <div className="font-mono text-[11px] tracking-[0.12em] text-[color:var(--ink-3)]">
          PODGLĄD
        </div>

        <div className="mt-6 flex-1 flex flex-col bg-[color:var(--surface)] rounded-[14px] border border-[color:var(--line)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="h-14 border-b border-[color:var(--line)] flex items-center gap-3 px-5">
            <div className="h-2.5 w-[110px] rounded-[5px] bg-[color:var(--line)]" />
            <div className="flex-1" />
            <div className="h-2.5 w-[60px] rounded-[5px] bg-[color:var(--line)]" />
            <div className="h-7 w-7 rounded-full bg-[color:var(--line)]" />
          </div>

          <div className="flex-1 grid grid-cols-[180px_1fr]">
            <div className="border-r border-[color:var(--line)] p-5 flex flex-col gap-3.5">
              <div className="h-3 rounded bg-[color:var(--line)]" />
              <div className="h-3 rounded bg-[color:var(--line)]" />
              <div className="h-3 rounded bg-[color:var(--line)]" />
              <div className="h-3 rounded bg-[color:var(--line)]" />
            </div>
            <div className="p-5 grid grid-cols-2 gap-3.5 auto-rows-[120px]">
              <div className="col-span-2 bg-[#F8F7F2] border border-[color:var(--line)] rounded-[10px]" />
              <div className="bg-[#F8F7F2] border border-[color:var(--line)] rounded-[10px]" />
              <div className="bg-[#F8F7F2] border border-[color:var(--line)] rounded-[10px]" />
              <div className="bg-[#F8F7F2] border border-[color:var(--line)] rounded-[10px]" />
              <div className="bg-[#F8F7F2] border border-[color:var(--line)] rounded-[10px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
