import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';

const queryClient = new QueryClient();

function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('API unavailable');
      const data: { status: string; service: string } = await response.json();
      if (data.status !== 'ok') throw new Error('API unavailable');
      return data;
    },
    retry: 1,
    refetchInterval: 15000,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">QuickDesk</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight">Support starts here.</h1>
      <p className="mt-6 max-w-xl text-lg text-slate-600">A workspace for employee requests and thoughtful, AI-assisted support.</p>
      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Project setup</h2>
        <p role="status" className="mt-3 text-slate-600">
          {health.isPending ? 'Connecting to the API…' : health.isError ? 'API is offline. Start the backend to connect.' : 'API connected.'}
        </p>
        <p className="mt-3 text-sm text-slate-500">Authentication, tickets, and knowledge-base search are the next implementation steps.</p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
