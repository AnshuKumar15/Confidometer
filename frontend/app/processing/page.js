import { Suspense } from "react";
import Loader from "@/components/Loader";
import ProcessingClient from "@/app/processing/ProcessingClient";

export default function ProcessingPage() {
  return (
    <Suspense fallback={<Loader subtitle="Warming up the analysis engine..." />}>
      <ProcessingClient />
    </Suspense>
  );
}
