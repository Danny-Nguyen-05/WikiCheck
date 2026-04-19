import SearchBar from "@/components/SearchBar";
import LightRays from "@/components/LightRays";

export default function Home() {
  return (
    <main className="relative flex h-screen flex-col items-center justify-center bg-[#0a0f1a] overflow-hidden">
      {/* LightRays perform optimally and beautifully on dark backgrounds */}
      <div className="absolute inset-0 z-0 opacity-100 mix-blend-screen brightness-200 contrast-125">
        <LightRays
          raysOrigin="top-center"
          raysColor="#ffffff"
          raysSpeed={1}
          lightSpread={0.5}
          rayLength={3}
          fadeDistance={1}
          saturation={1}
          mouseInfluence={0.1}
          noiseAmount={0}
          distortion={0}
          pulsating={false}
          className="custom-rays"
        />
      </div>

      <div className="relative z-10 w-full max-w-3xl px-6 flex flex-col items-center drop-shadow-2xl">
        <h1 className="mb-10 text-[56px] font-semibold tracking-tight text-white drop-shadow-sm">
          Wiki<span className="text-blue-500">Check</span>
        </h1>
        <div className="w-full">
          <SearchBar variant="default" />
        </div>
        <div className="mt-8 flex gap-4 text-sm font-medium text-blue-200 opacity-80 mix-blend-screen drop-shadow-sm">
          <span>Verify Wikipedia citations with AI</span>
        </div>
      </div>
    </main>
  );
}
