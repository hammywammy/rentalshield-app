import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error:', error);
        router.push('/login');
      } else if (data.session) {
        router.push('/dashboard'); // or wherever you want to redirect after login
      } else {
        router.push('/login');
      }
    };

    handleAuthCallback();
  }, [router]);

  return <div className="p-4">Processing login...</div>;
}