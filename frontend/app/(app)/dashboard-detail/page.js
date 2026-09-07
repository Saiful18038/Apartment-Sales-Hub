"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErrorBanner, LoadingBlock, inputCls } from "@/components/ui";
import { useDashboardData } from "@/lib/useDashboardData";
import DashboardDetailBody, { DETAIL_TITLES } from "@/components/DashboardDetailBody";

function DashboardDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailKey = searchParams.get("key");
  const data = useDashboardData();

  if (data.loading) return <LoadingBlock />;
  if (data.error) return <ErrorBanner message={data.error} />;

  const title = DETAIL_TITLES[detailKey];
  if (!title) return <ErrorBanner message="Unknown dashboard detail." />;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard/" className="inline-flex items-center gap-1.5 text-sm text-[#1F3864] hover:underline mb-2">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          {/* Owner's request: switch between any of the 9 cards' details
              right here in the same tab, instead of going back to the
              Dashboard and clicking a different card each time. */}
          <select
            className={inputCls}
            style={{ width: 240 }}
            value={detailKey}
            onChange={(e) => router.push(`/dashboard-detail/?key=${e.target.value}`)}
          >
            {Object.entries(DETAIL_TITLES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="shadow-premium bg-white rounded-2xl p-5">
        <DashboardDetailBody detailKey={detailKey} data={data} />
      </div>
    </div>
  );
}

export default function DashboardDetailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DashboardDetailContent />
    </Suspense>
  );
}
