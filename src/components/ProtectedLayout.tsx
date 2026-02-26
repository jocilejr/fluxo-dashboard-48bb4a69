import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AppLayout } from "./AppLayout";
import { MobileLayout } from "./mobile/MobileLayout";
import ProtectedRoute from "./ProtectedRoute";
import { PageTransition } from "./PageTransition";

export function ProtectedLayout() {
  const isMobile = useIsMobile();

  return (
    <ProtectedRoute>
      {isMobile ? (
        <MobileLayout>
          <Suspense fallback={<PageTransition />}>
            <Outlet />
          </Suspense>
        </MobileLayout>
      ) : (
        <AppLayout>
          <Suspense fallback={<PageTransition />}>
            <Outlet />
          </Suspense>
        </AppLayout>
      )}
    </ProtectedRoute>
  );
}
