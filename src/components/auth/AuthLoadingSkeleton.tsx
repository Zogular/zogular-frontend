import { BrandLogo } from "@/components/brand/BrandLogo";

export function AuthLoadingSkeleton() {
  return (
    <main className="auth-viewport relative w-full bg-cover bg-center bg-no-repeat lg:grid lg:grid-cols-2 bg-[#071c13]">
      <div className="absolute inset-0 z-0 bg-black/60 lg:bg-black/40"></div>
      <div className="auth-panel relative z-10 flex flex-col justify-center border-r border-white/10 bg-black/30 px-6 shadow-[0_0_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl supports-backdrop-filter:bg-black/20 lg:px-12">
        <div className="mx-auto w-full max-w-90">
          <div className="mb-8 space-y-4 text-center lg:text-left animate-pulse">
            <div className="flex items-center justify-center lg:justify-start">
              <BrandLogo variant="dark" imageClassName="h-9 w-auto opacity-50" />
            </div>
            <div className="space-y-3 pt-2 flex flex-col items-center lg:items-start">
              <div className="h-8 w-3/4 rounded-md bg-white/10"></div>
              <div className="h-4 w-5/6 rounded-md bg-white/10"></div>
            </div>
          </div>
          <div className="space-y-5 animate-pulse pt-2">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-white/10"></div>
              <div className="h-10 w-full rounded-xl bg-white/5"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-white/10"></div>
              <div className="h-10 w-full rounded-xl bg-white/5"></div>
            </div>
            <div className="pt-4">
              <div className="h-11 w-full rounded-xl bg-white/10"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 hidden flex-col justify-end p-16 lg:flex xl:p-24 animate-pulse">
        <div className="max-w-lg space-y-4">
          <div className="h-12 w-4/5 rounded-md bg-white/10"></div>
          <div className="h-12 w-2/3 rounded-md bg-white/10"></div>
          <div className="pt-2">
            <div className="h-5 w-full rounded-md bg-white/5"></div>
            <div className="mt-2 h-5 w-5/6 rounded-md bg-white/5"></div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function AuthCenteredSkeleton() {
  return (
    <main data-centered-auth className="auth-viewport flex items-center justify-center bg-[#071c13] px-6 text-white min-h-screen">
      <div className="mx-auto w-full max-w-sm animate-pulse space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex justify-center">
          <BrandLogo variant="dark" imageClassName="h-8 w-auto opacity-50" />
        </div>
        <div className="space-y-4 pt-2">
          <div className="h-8 w-3/4 mx-auto rounded-md bg-white/10"></div>
          <div className="h-4 w-5/6 mx-auto rounded-md bg-white/10"></div>
        </div>
        <div className="space-y-4 pt-4">
          <div className="h-10 w-full rounded-xl bg-white/5"></div>
          <div className="h-10 w-full rounded-xl bg-white/5"></div>
        </div>
        <div className="pt-4">
          <div className="h-11 w-full rounded-xl bg-white/10"></div>
        </div>
      </div>
    </main>
  );
}
