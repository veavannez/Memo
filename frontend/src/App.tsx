import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import AppShell from './AppShell';

// Pages
import LandingPage from './pages/LandingPage';
import DemoPage from './pages/DemoPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ProjectsPage from './pages/ProjectsPage';
import RepositorySelectionPage from './pages/RepositorySelectionPage';
import DashboardPage from './pages/DashboardPage';
import MemosHistoryPage from './pages/MemosHistoryPage';
import MemoDetailPage from './pages/MemoDetailPage';
import CreateMemoPage from './pages/CreateMemoPage';
import TasksPage from './pages/TasksPage';
import KanbanPage from './pages/KanbanPage';
import CatchMeUpPage from './pages/CatchMeUpPage';
import ProjectContextPage from './pages/ProjectContextPage';
import ProjectIntelligencePage from './pages/ProjectIntelligencePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected routes */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<RepositorySelectionPage />} />
        <Route path="/projects/:projectId" element={<DashboardPage />} />
        <Route path="/projects/:projectId/context" element={<ProjectContextPage />} />
        <Route path="/projects/:projectId/intelligence" element={<ProjectIntelligencePage />} />
        <Route path="/projects/:projectId/memos" element={<MemosHistoryPage />} />
        <Route path="/projects/:projectId/memos/new" element={<CreateMemoPage />} />
        <Route path="/projects/:projectId/memos/:memoId" element={<MemoDetailPage />} />
        <Route path="/projects/:projectId/tasks" element={<TasksPage />} />
        <Route path="/projects/:projectId/kanban" element={<KanbanPage />} />
        <Route path="/projects/:projectId/catch-me-up" element={<CatchMeUpPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
