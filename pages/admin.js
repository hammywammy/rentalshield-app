import ProtectedRoute from '../components/ProtectedRoute';

export default function AdminPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <div className="p-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p>This page is only visible to admins.</p>
      </div>
    </ProtectedRoute>
  );
}