import { useRouteError } from 'react-router-dom';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const isDynamicImportError =
    error instanceof TypeError && error.message.includes('Failed to fetch dynamically imported module');

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {isDynamicImportError ? 'Page failed to load' : 'Something went wrong'}
        </h1>
        <p className="text-gray-500 mb-6 text-sm">
          {isDynamicImportError
            ? 'This usually happens after a network interruption. Reloading the page should fix it.'
            : 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse bg-gray-200 rounded-lg w-3/4 h-64" />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800">404</h1>
        <p className="text-gray-500 mt-2">Page not found</p>
      </div>
    </div>
  );
}
