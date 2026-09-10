"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { LoadingBlock, ErrorBanner } from "@/components/ui";
import PriceSchedule from "@/components/PriceSchedule";

// Opened in a new browser tab from the Payments list (?sale=<id>) — same
// pattern as the dashboard cards' /dashboard-detail/ pages. Shows the sale's
// "Final Price & Payment Schedule" document (price breakdown + instalments,
// PDF/Excel export). The component fetches its own data by sale id.
function PaymentSheetContent() {
  const searchParams = useSearchParams();
  const saleId = Number(searchParams.get("sale"));
  const { user } = useAuth();
  const canManage = user.role === "owner" || user.role === "admin";

  if (!saleId) return <ErrorBanner message="No sale selected." />;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/payments/" className="inline-flex items-center gap-1.5 text-sm text-[#1F3864] hover:underline mb-2">
          <ArrowLeft size={14} /> Back to Payments
        </Link>
        <h2 className="text-lg font-semibold text-slate-800">Price &amp; Payment Schedule</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <PriceSchedule saleId={saleId} canManage={canManage} />
      </div>
    </div>
  );
}

export default function PaymentSheetPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PaymentSheetContent />
    </Suspense>
  );
}
