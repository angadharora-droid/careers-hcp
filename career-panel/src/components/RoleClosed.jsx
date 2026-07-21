import { Link } from 'react-router-dom';
import { AlertCircleIcon } from './Icons';

export default function RoleClosed() {
  return (
    <div className="bg-card border border-line rounded-sm p-8 sm:p-12 text-center max-w-xl mx-auto">
      <div className="w-14 h-14 mx-auto rounded-full bg-beige text-body flex items-center justify-center">
        <AlertCircleIcon size={26} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold text-ink leading-snug">
        This role is no longer accepting applications
      </h1>
      <p className="mt-3 text-[13px] text-body leading-relaxed">
        The opening may have been filled or temporarily paused. We add new opportunities through
        the year — please have a look at our other open roles.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[40px] mt-7 bg-berry text-white font-button text-xs uppercase tracking-[2px] font-medium px-6 py-2.5 rounded-sm hover:bg-berry-dark active:scale-[0.98] transition duration-200"
      >
        Browse open positions
      </Link>
    </div>
  );
}
