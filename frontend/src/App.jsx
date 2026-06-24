import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/auth";

function AppContent() {
  const { loading, token, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-base font-black text-white">
            SS
          </div>
          <p className="text-sm font-medium text-gray-500">Loading SpendSmart…</p>
        </div>
      </div>
    );
  }

  return token && user ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
