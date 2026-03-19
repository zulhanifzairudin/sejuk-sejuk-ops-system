import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type CompletedOrder = {
  order_no: string
  assigned_technician?: string | null
  final_amount?: number | string | null
  status?: string | null
}

type TechnicianKpi = {
  name: string
  jobsCompleted: number
  totalEarnings: number
}

const ManagerDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedJobs, setCompletedJobs] = useState<CompletedOrder[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('orders')
        .select('order_no, assigned_technician, final_amount, status')
        .eq('status', 'Job Done')

      if (cancelled) return

      if (error) {
        setError(error.message)
        setCompletedJobs([])
      } else {
        setCompletedJobs((data ?? []) as CompletedOrder[])
      }

      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const kpis: TechnicianKpi[] = useMemo(() => {
    const byTech = new Map<string, TechnicianKpi>()

    for (const job of completedJobs) {
      const name = (job.assigned_technician || 'Unassigned').trim() || 'Unassigned'
      const rawAmount = job.final_amount
      const amount =
        typeof rawAmount === 'number'
          ? rawAmount
          : typeof rawAmount === 'string'
            ? Number(rawAmount) || 0
            : 0

      const current = byTech.get(name) ?? {
        name,
        jobsCompleted: 0,
        totalEarnings: 0,
      }

      current.jobsCompleted += 1
      current.totalEarnings += amount

      byTech.set(name, current)
    }

    return Array.from(byTech.values()).sort(
      (a, b) => b.jobsCompleted - a.jobsCompleted || b.totalEarnings - a.totalEarnings,
    )
  }, [completedJobs])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Overview of completed jobs and technician performance.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 uppercase">
              Completed Jobs
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {completedJobs.length}
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 uppercase">
              Total Technicians (with completed jobs)
            </div>
            <div className="mt-2 text-2xl font-semibold">{kpis.length}</div>
          </div>

          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 uppercase">
              Total Earnings
            </div>
            <div className="mt-2 text-2xl font-semibold">
              RM{' '}
              {kpis
                .reduce((sum, t) => sum + t.totalEarnings, 0)
                .toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Technician Performance</h2>
            {loading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : null}
          </div>

          {kpis.length === 0 ? (
            <div className="text-sm text-gray-500">
              No completed jobs yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpis.map((t) => (
                <div
                  key={t.name}
                  className="border rounded-lg p-4 flex flex-col gap-2 bg-gray-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs uppercase text-gray-500">
                      Jobs Completed
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="text-2xl font-semibold">
                      {t.jobsCompleted}
                    </div>
                    <div className="text-sm text-gray-700">
                      Total: RM {t.totalEarnings.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManagerDashboard
