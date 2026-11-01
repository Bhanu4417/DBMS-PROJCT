import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-soft text-muted">
        <Compass size={24} />
      </span>
      <h1 className="text-lg font-semibold text-ink">Page not found</h1>
      <p className="max-w-sm text-sm text-muted">
        The page you asked for does not exist. Use the sidebar to navigate the administration area.
      </p>
      <Link to="/" className="btn-primary">Back to dashboard</Link>
    </div>
  );
}
