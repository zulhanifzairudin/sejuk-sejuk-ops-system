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

type AiIntent = 'TODAY_JOBS' | 'WEEK_JOBS' | 'TOP_TECHNICIAN' | 'TECHNICIAN_JOBS'

type AiIntentResult =
  | { intent: Exclude<AiIntent, 'TECHNICIAN_JOBS'> }
  | { intent: 'TECHNICIAN_JOBS'; technicianName: string }

function interpretQuestion(
  question: string,
  technicianNames: string[],
): AiIntentResult | null {
  const q = question.toLowerCase()

  if (q.includes('today')) return { intent: 'TODAY_JOBS' } as const
  if (q.includes('week')) return { intent: 'WEEK_JOBS' } as const
  if (q.includes('most')) return { intent: 'TOP_TECHNICIAN' } as const

  // Technician name match (fallback)
  const normalizedTechNames = technicianNames
    .map((n) => n.trim())
    .filter(Boolean)

  // Match technician names more safely to avoid substring collisions
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean)

  const found = normalizedTechNames.find((name) =>
    tokens.includes(name.toLowerCase()),
  )

  if (found) {
    return { intent: 'TECHNICIAN_JOBS', technicianName: found } as const
  }

  return null
}

function toMoneyNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function formatOrderList(orderNos: string[]) {
  if (orderNos.length <= 2) return orderNos.join(', ')
  return `${orderNos.slice(0, 2).join(', ')}, …`
}

function formatAiResponse(
  intent: AiIntentResult | null,
  aiData: CompletedOrder[],
): string {
  if (!intent) {
    return `Sorry, I can only answer basic operational questions.

Try asking:
- Jobs completed today
- Top technician this week
- Jobs by technician (e.g. Ali)`
  }

  const jobsCount = aiData.length
  const orderNos = aiData.map((j) => j.order_no)

  const byTech = new Map<string, { jobs: number; earnings: number }>()
  for (const job of aiData) {
    const name = (job.assigned_technician ?? 'Unassigned').trim() || 'Unassigned'
    const prev = byTech.get(name) ?? { jobs: 0, earnings: 0 }
    prev.jobs += 1
    prev.earnings += toMoneyNumber(job.final_amount)
    byTech.set(name, prev)
  }

  const topTech = Array.from(byTech.entries()).sort(
    (a, b) => b[1].jobs - a[1].jobs || b[1].earnings - a[1].earnings,
  )[0]

  const workloadInsight = (count: number) => {
    if (count === 0) return 'This may indicate no activity during this period.'
    if (count <= 2) return 'This indicates a light workload.'
    if (count <= 5) return 'This indicates a moderate workload.'
    return 'This indicates a high workload.'
  }

  if (intent.intent === 'TECHNICIAN_JOBS') {
    const tech = intent.technicianName
    const techJobs = aiData.filter((j) => (j.assigned_technician ?? '') === tech)
    const count = techJobs.length
    const techOrders = techJobs.map((j) => j.order_no)
    const totalEarnings = techJobs.reduce(
      (sum, j) => sum + toMoneyNumber(j.final_amount),
      0,
    )

    if (count === 0) {
      return `No completed jobs found for technician ${tech}.`
    }

    return `Technician ${tech} completed ${count} job${
      count === 1 ? '' : 's'
    }: ${formatOrderList(techOrders)} (Total: RM ${totalEarnings.toFixed(
      2,
    )}). ${workloadInsight(count)}`
  }

  if (intent.intent === 'TODAY_JOBS') {
    if (jobsCount === 0) {
      return `No jobs were completed today. ${workloadInsight(0)}`
    }
    return `Jobs completed today: ${jobsCount}. Top technician: ${
      topTech?.[0] ?? 'Unassigned'
    } (${topTech?.[1].jobs ?? 0}). Orders: ${formatOrderList(
      orderNos,
    )}. ${workloadInsight(jobsCount)}`
  }

  if (intent.intent === 'WEEK_JOBS') {
    if (jobsCount === 0) {
      return `No jobs were completed this week. ${workloadInsight(0)}`
    }
    return `Jobs completed this week: ${jobsCount}. Top technician: ${
      topTech?.[0] ?? 'Unassigned'
    } (${topTech?.[1].jobs ?? 0}). Orders: ${formatOrderList(
      orderNos,
    )}. ${workloadInsight(jobsCount)}`
  }

  // TOP_TECHNICIAN
  if (jobsCount === 0) {
    return `No jobs were completed this week. ${workloadInsight(0)}`
  }
  const tech = topTech?.[0] ?? 'Unassigned'
  const count = topTech?.[1].jobs ?? 0
  const techOrders = aiData
    .filter((j) => (j.assigned_technician ?? 'Unassigned') === tech)
    .map((j) => j.order_no)

  return `Top technician this week is ${tech} with ${count} job${
    count === 1 ? '' : 's'
  }: ${formatOrderList(techOrders)}. ${workloadInsight(count)}`
}

const ManagerDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedJobs, setCompletedJobs] = useState<CompletedOrder[]>([])

  // Fake AI query UI
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)

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

  const fetchTodayJobs = async (): Promise<CompletedOrder[]> => {
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('orders')
      .select('order_no, assigned_technician, final_amount, completed_at')
      .eq('status', 'Job Done')
      .gte('completed_at', startOfToday.toISOString())
      .lt('completed_at', now.toISOString())
      .order('completed_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as CompletedOrder[]
  }

  const fetchWeekJobs = async (): Promise<CompletedOrder[]> => {
    const now = new Date()
    const start = new Date(now)
    // "This week" interpreted as the last 7 days including today
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('orders')
      .select('order_no, assigned_technician, final_amount, completed_at')
      .eq('status', 'Job Done')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', now.toISOString())
      .order('completed_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as CompletedOrder[]
  }

  const fetchJobsByTechnician = async (technicianName: string) => {
    const tech = technicianName.trim()
    if (!tech) return [] as CompletedOrder[]

    const { data, error } = await supabase
      .from('orders')
      .select('order_no, assigned_technician, final_amount, completed_at')
      .eq('status', 'Job Done')
      .eq('assigned_technician', tech)
      .order('completed_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as CompletedOrder[]
  }

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

  const askAi = async () => {
    const question = aiQuestion.trim()
    if (!question) return

    setAiLoading(true)
    setAiError(null)
    setAiAnswer(null)

    try {
      const technicianNames = Array.from(
        new Set(
          completedJobs
            .map((j) => j.assigned_technician)
            .filter((n): n is string => typeof n === 'string' && n.trim().length > 0),
        ),
      )

      const intentResult = interpretQuestion(question, technicianNames)

      let aiData: CompletedOrder[] = completedJobs
      if (intentResult?.intent === 'TODAY_JOBS') {
        aiData = await fetchTodayJobs()
      } else if (intentResult?.intent === 'WEEK_JOBS') {
        aiData = await fetchWeekJobs()
      } else if (intentResult?.intent === 'TOP_TECHNICIAN') {
        // mock backend can ignore intent; we still scope the data to week.
        aiData = await fetchWeekJobs()
      } else if (
        intentResult?.intent === 'TECHNICIAN_JOBS' &&
        typeof intentResult.technicianName === 'string'
      ) {
        aiData = await fetchJobsByTechnician(intentResult.technicianName)
      }

      // Frontend-only "fake AI": interpret + query Supabase + format.
      const formatted = formatAiResponse(intentResult, aiData)
      setAiAnswer(formatted)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to call AI server')
    } finally {
      setAiLoading(false)
    }
  }

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

        {/* AI Query UI */}
        <div className="bg-white border rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">Operations AI Query</h2>
          <p className="text-sm text-gray-600 mt-1">
            Ask a question about completed service jobs.
          </p>

          <div className="mt-4 space-y-3">
            <input
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="e.g. How many jobs did Ali complete?"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => void askAi()}
                disabled={aiLoading || !aiQuestion.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:hover:bg-blue-700 text-sm font-medium"
              >
                {aiLoading ? 'Asking…' : 'Ask'}
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => {
                  setAiQuestion('')
                  setAiAnswer(null)
                  setAiError(null)
                }}
                className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-white text-sm"
              >
                Clear
              </button>
            </div>

            {aiError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {aiError}
              </div>
            ) : null}

            <div className="text-xs text-gray-500">
              Try asking:
              <div>- Jobs completed today</div>
              <div>- Top technician this week</div>
              <div>- Jobs by technician (e.g. Ali)</div>
            </div>

            {aiLoading ? (
              <div className="text-sm text-gray-500">Analyzing data...</div>
            ) : null}

            {aiAnswer ? (
              <div>
                <div className="text-xs uppercase text-gray-500 mb-1">AI Response</div>
                <pre className="text-sm bg-gray-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                  {aiAnswer}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerDashboard
