import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import { AuthProvider } from '../features/auth/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock api calls
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('not authenticated')),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>{ui}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('LandingPage', () => {
  it('renders the MEMO heading', async () => {
    wrap(<LandingPage />);
    expect(screen.getByText('MEMO')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    wrap(<LandingPage />);
    expect(screen.getByText(/Save your work/i)).toBeInTheDocument();
  });

  it('renders the GitHub login button', () => {
    wrap(<LandingPage />);
    expect(screen.getByText(/Continue with GitHub/i)).toBeInTheDocument();
  });

  it('renders feature cards', () => {
    wrap(<LandingPage />);
    expect(screen.getByText('End Session')).toBeInTheDocument();
    expect(screen.getByText('Create Tasks')).toBeInTheDocument();
    expect(screen.getByText('Kanban Board')).toBeInTheDocument();
    expect(screen.getByText('Catch Me Up')).toBeInTheDocument();
  });
});
