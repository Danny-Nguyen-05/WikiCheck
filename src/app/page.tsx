import SearchBar from "@/components/SearchBar";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-5xl font-bold text-gray-900 dark:text-white">
          Wiki<span className="text-blue-600">Check</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Verify Wikipedia citations with AI
        </p>
      </div>
      <SearchBar />
      <div className="mt-8 flex items-center gap-2 text-sm text-gray-400">
        <span>Powered by Wikipedia &amp; Gemini AI</span>
      </div>
    </main>
  );
}
