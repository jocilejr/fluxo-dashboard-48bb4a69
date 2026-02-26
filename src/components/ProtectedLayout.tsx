import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AppLayout } from "./AppLayout";
import { MobileLayout } from "./mobile/MobileLayout";
import ProtectedRoute from "./ProtectedRoute";

export function ProtectedLayout() {
  const isMobile = useIsMobile();

  return (
    <ProtectedRoute>
      {isMobile ? (
        <MobileLayout>
          <Outlet />
        </MobileLayout>
      ) : (
        <AppLayout>
          <Outlet />
        </AppLayout>
      )}
    </ProtectedRoute>
  );
}
