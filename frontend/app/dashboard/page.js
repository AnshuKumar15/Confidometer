import { Suspense } from "react";
import DashboardClient from "@/app/dashboard/DashboardClient";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="muted centered">Loading dashboard...</p>}>
      <DashboardClient />
    </Suspense>
  );
}
