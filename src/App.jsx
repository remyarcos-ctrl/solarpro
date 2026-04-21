import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
// Lazy-load : NewDossier + DossierDetail importent Mapbox/jspdf/recharts
// (~ 3 MB) → on ne les charge pas pour la page Dashboard d'accueil.
const NewDossier    = lazy(() => import('@/pages/NewDossier'));
const DossierDetail = lazy(() => import('@/pages/DossierDetail'));
const PanelLibrary  = lazy(() => import('@/pages/PanelLibrary'));
const Settings      = lazy(() => import('@/pages/Settings'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nouveau-dossier" element={<NewDossier />} />
          <Route path="/dossier/:id" element={<DossierDetail />} />
          <Route path="/panneaux" element={<PanelLibrary />} />
          <Route path="/parametres" element={<Settings />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="top-right" theme="dark" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App