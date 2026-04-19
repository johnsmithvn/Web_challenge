/**
 * HabitsPage — DEPRECATED in v1.9.0
 * All features merged into TrackerPage.
 * This file only exists for backward-compatible redirect.
 */
import { Navigate } from 'react-router-dom';

export default function HabitsPage() {
  return <Navigate to="/tracker" replace />;
}
