"use client";
import { supabase } from '@/app/lib/supabase';

interface Battle {
  id: string;
  name: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}

// server component – performs the query during SSR so that `curl` and
// automated tests can verify results without relying on client-side JS.
export default async function TestPage() {
  let battles: Battle[] = [];
  let errorMessage: string | null = null;

  try {
    const { data, error } = await supabase.from('battles').select('*');
    if (error) {
      errorMessage = error.message;
    } else {
      battles = data || [];
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // render results directly
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Supabase Connection Test</h1>

        {errorMessage ? (
          <div className="bg-red-900 rounded-lg p-6 border border-red-700">
            <p className="text-red-100 font-semibold">Error:</p>
            <p className="text-red-200">{errorMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-300">
              Found <span className="font-bold text-green-400">{battles.length}</span>{' '}
              battle{battles.length !== 1 ? 's' : ''} in Supabase
            </p>

            {battles.length === 0 ? (
              <div className="bg-slate-700 rounded-lg p-6 text-gray-300">
                <p>No battles found in the database.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {battles.map((battle) => (
                  <div
                    key={battle.id}
                    className="bg-slate-700 rounded-lg p-6 border border-slate-600"
                  >
                    <h2 className="text-xl font-bold text-white mb-2">{battle.name}</h2>
                    {battle.description && (
                      <p className="text-gray-300 mb-3">{battle.description}</p>
                    )}
                    {battle.status && (
                      <p className="text-sm text-gray-400">
                        Status:{' '}
                        <span className="font-semibold text-blue-300">{battle.status}</span>
                      </p>
                    )}
                    <pre className="mt-4 bg-slate-800 p-3 rounded text-xs text-gray-300 overflow-auto">
                      {JSON.stringify(battle, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
