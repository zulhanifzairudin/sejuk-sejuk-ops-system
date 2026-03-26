import { useNavigate } from 'react-router-dom'

const Login = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f5f4f1] flex items-center justify-center px-4"
         style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(0,0,0,0.03), transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,0,0,0.03), transparent 50%)' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl px-10 py-11"
           style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.07)' }}>

        <h1 className="text-[22px] font-serif font-medium text-gray-950 tracking-tight">
          Sejuk Sejuk Ops
        </h1>
        <p className="text-[13px] text-gray-600 mt-1.5">
          Select a role to continue
        </p>

        <div className="my-7 h-px bg-gray-100" />

        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-350 mb-3.5">
          Continue as
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-xl bg-gray-900 text-white px-4 py-3 text-sm font-medium hover:bg-gray-800 transition-all"
            onClick={() => navigate('/admin')}
          >
            Admin <span className="opacity-50">→</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-xl bg-[#f5f4f1] text-gray-700 px-4 py-3 text-sm font-medium hover:bg-[#eeedea] transition-all"
            onClick={() => navigate('/technician')}
          >
            Technician <span className="opacity-50">→</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-xl bg-[#f5f4f1] text-gray-700 px-4 py-3 text-sm font-medium hover:bg-[#eeedea] transition-all"
            onClick={() => navigate('/manager')}
          >
            Manager <span className="opacity-50">→</span>
          </button>
        </div>

        <p className="mt-7 text-center text-[11.5px] text-gray-500">
          Mock login — no credentials required
        </p>
      </div>
    </div>
  )
}

export default Login