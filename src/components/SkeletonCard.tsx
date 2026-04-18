"use client";

export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4  ">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-8 rounded bg-gray-200 " />
          <div className="h-6 w-32 rounded bg-gray-200 " />
        </div>
        <div className="h-6 w-12 rounded bg-gray-200 " />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full rounded bg-gray-200 " />
        <div className="h-4 w-3/4 rounded bg-gray-200 " />
      </div>
      <div className="mt-3 h-16 w-full rounded bg-gray-100 " />
      <div className="mt-3 h-4 w-full rounded bg-gray-200 " />
    </div>
  );
}
