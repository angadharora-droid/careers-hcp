import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="bg-card border border-line rounded-sm p-12">
        <p className="font-display text-5xl font-semibold text-berry">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-3 text-[13px] text-body">
          The page you are looking for doesn't exist or may have moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[40px] mt-7 bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-6 py-2.5 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200"
        >
          Browse open positions
        </Link>
      </div>
    </div>
  );
}
