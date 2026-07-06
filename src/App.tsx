import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { HouseholdProvider, useHousehold } from "@/hooks/useHousehold";
import { PageLoader } from "@/components/common";
import { Login } from "@/pages/Login";
import { Onboarding } from "@/pages/Onboarding";
import { AppLayout } from "@/components/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { ShoppingPage } from "@/pages/ShoppingPage";
import { TasksPage } from "@/pages/TasksPage";
import { MealPlanPage } from "@/pages/MealPlanPage";
import { BudgetPage } from "@/pages/BudgetPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { SettingsPage } from "@/pages/SettingsPage";

function AuthedApp() {
  const { households, loading } = useHousehold();

  if (loading) return <PageLoader label="Haushalte werden geladen…" />;
  if (households.length === 0) return <Onboarding />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="/einkauf" element={<ShoppingPage />} />
        <Route path="/aufgaben" element={<TasksPage />} />
        <Route path="/essensplan" element={<MealPlanPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/kalender" element={<CalendarPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Login />;

  return (
    <HouseholdProvider>
      <AuthedApp />
    </HouseholdProvider>
  );
}
