"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErrorBanner, LoadingBlock } from "@/components/ui";
import { useDashboardData } from "@/lib/useDashboardData";
import DashboardDetailBody, { DETAIL_TITLES } from "@/components/DashboardDetailBody";

function DashboardDetailContent() {
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
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
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
