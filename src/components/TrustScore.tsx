"use client";

interface TrustScoreProps {
  score: number; // 0-100
}

export default function TrustScore({ score }: TrustScoreProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let color = "text-red-500";
  if (score >= 70) color = "text-green-500";
  else if (score >= 40) color = "text-yellow-500";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 "
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${color} transition-all duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${color}`}>{score}%</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-900 ">Trust Score</div>
        <div className="text-xs text-gray-500 ">
          {score >= 70 ? "High confidence" : score >= 40 ? "Moderate confidence" : "Low confidence"}
        </div>
      </div>
    </div>
  );
}
