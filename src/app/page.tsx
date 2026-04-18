import SearchBar from "@/components/SearchBar";

export default function Home() {
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-[#fbfbfd]">
      <div className="w-full max-w-3xl px-6 flex flex-col items-center">
        <h1 className="mb-10 text-[56px] font-semibold tracking-tight text-[#1d1d1f]">
          Wiki<span className="text-blue-500">Check</span>
        </h1>
        <div className="w-full">
          <SearchBar variant="default" />
        </div>
        <div className="mt-8 flex gap-4 text-sm font-medium text-[#86868b]">
          <span>Verify Wikipedia citations with AI</span>
        </div>
      </div>
    </main>
  );
}
