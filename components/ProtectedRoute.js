import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requiredRole = null, adminOnly = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Not logged in - redirect to login
      if (!user) {
        router.push('/login');
        return;
      }

      // Check admin requirement
      if (adminOnly && user.role !== 'admin') {
        router.push('/unauthorized');
        return;
      }

      // Check specific role requirement
      if (requiredRole && user.role !== requiredRole) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [user, loading, router, requiredRole, adminOnly]);

  // Show loading while checking auth
  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  // Show nothing while redirecting
  if (!user || (adminOnly && user.role !== 'admin') || (requiredRole && user.role !== requiredRole)) {
    return <div className="p-4">Redirecting...</div>;
  }

  return <>{children}</>;
}