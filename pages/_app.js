import { AuthProvider } from '../context/AuthContext';
import '../styles/globals.css'; // if you have global styles

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}