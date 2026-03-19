import { useNavigate } from 'react-router-dom'

const Login = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-2xl p-6">
        <h1 className="text-2xl font-bold">Sejuk Sejuk Ops</h1>
        <p className="text-sm text-gray-600 mt-1">
          Select a role to continue (mock login).
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
            onClick={() => navigate('/admin')}
          >
            Admin
          </button>
          <button
            type="button"
            className="w-full rounded-lg bg-white border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={() => navigate('/technician')}
          >
            Technician
          </button>
          <button
            type="button"
            className="w-full rounded-lg bg-white border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            onClick={() => navigate('/manager')}
          >
            Manager
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
