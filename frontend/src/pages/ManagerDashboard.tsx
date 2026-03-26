import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type CompletedOrder = {
  order_no: string
  assigned_technician?: string | null
  final_amount?: number | string | null
  status?: string | null
}

type TechnicianKpi = { name: string; jobsCompleted: number; totalEarnings: number }
type AiIntent = 'TODAY_JOBS' | 'WEEK_JOBS' | 'TOP_TECHNICIAN' | 'TECHNICIAN_JOBS'
type AiIntentResult =
  | { intent: Exclude<AiIntent, 'TECHNICIAN_JOBS'> }
  | { intent: 'TECHNICIAN_JOBS'; technicianName: string }

function interpretQuestion(question: string, technicianNames: string[]): AiIntentResult | null {
  const q = question.toLowerCase()
  if (q.includes('today')) return { intent: 'TODAY_JOBS' }
  if (q.includes('week')) return { intent: 'WEEK_JOBS' }
  if (q.includes('most')) return { intent: 'TOP_TECHNICIAN' }
  const tokens = q.split(/[^a-z0-9]+/).filter(Boolean)
  const found = technicianNames.map((n) => n.trim()).filter(Boolean)
    .find((name) => tokens.includes(name.toLowerCase()))
  if (found) return { intent: 'TECHNICIAN_JOBS', technicianName: found }
  return null
}

function toMoneyNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') { const n = Number(value); return Number.isFinite(n) ? n : 0 }
  return 0
}

function formatOrderList(orderNos: string[]) {
  if (orderNos.length <= 2) return orderNos.join(', ')
  return `${orderNos.slice(0, 2).join(', ')}, …`
}

function formatAiResponse(intent: AiIntentResult | null, aiData: CompletedOrder[]): string {
  if (!intent) return `Sorry, I can only answer basic operational questions.\n\nTry asking:\n- Jobs completed today\n- Top technician this week\n- Jobs by technician (e.g. Ali)`
  const jobsCount = aiData.length
  const orderNos = aiData.map((j) => j.order_no)
  const byTech = new Map<string, { jobs: number; earnings: number }>()
  for (const job of aiData) {
    const name = (job.assigned_technician ?? 'Unassigned').trim() || 'Unassigned'
    const prev = byTech.get(name) ?? { jobs: 0, earnings: 0 }
    prev.jobs += 1; prev.earnings += toMoneyNumber(job.final_amount)
    byTech.set(name, prev)
  }
  const topTech = Array.from(byTech.entries()).sort((a, b) => b[1].jobs - a[1].jobs || b[1].earnings - a[1].earnings)[0]
  const workloadInsight = (count: number) => {
    if (count === 0) return 'No activity during this period.'
    if (count <= 2) return 'Light workload.'
    if (count <= 5) return 'Moderate workload.'
    return 'High workload.'
  }
  if (intent.intent === 'TECHNICIAN_JOBS') {
    const tech = intent.technicianName
    const techJobs = aiData.filter((j) => (j.assigned_technician ?? '') === tech)
    const count = techJobs.length
    const totalEarnings = techJobs.reduce((sum, j) => sum + toMoneyNumber(j.final_amount), 0)
    if (count === 0) return `No completed jobs found for ${tech}.`
    return `${tech} completed ${count} job${count === 1 ? '' : 's'}: ${formatOrderList(techJobs.map((j) => j.order_no))} (RM ${totalEarnings.toFixed(2)}). ${workloadInsight(count)}`
  }
  if (intent.intent === 'TODAY_JOBS') {
    if (jobsCount === 0) return `No jobs completed today. ${workloadInsight(0)}`
    return `Jobs today: ${jobsCount}. Top: ${topTech?.[0] ?? 'Unassigned'} (${topTech?.[1].jobs ?? 0}). Orders: ${formatOrderList(orderNos)}. ${workloadInsight(jobsCount)}`
  }
  if (intent.intent === 'WEEK_JOBS') {
    if (jobsCount === 0) return `No jobs this week. ${workloadInsight(0)}`
    return `Jobs this week: ${jobsCount}. Top: ${topTech?.[0] ?? 'Unassigned'} (${topTech?.[1].jobs ?? 0}). Orders: ${formatOrderList(orderNos)}. ${workloadInsight(jobsCount)}`
  }
  if (jobsCount === 0) return `No jobs this week. ${workloadInsight(0)}`
  const tech = topTech?.[0] ?? 'Unassigned'
  const count = topTech?.[1].jobs ?? 0
  return `Top technician: ${tech} with ${count} job${count === 1 ? '' : 's'}: ${formatOrderList(aiData.filter((j) => (j.assigned_technician ?? 'Unassigned') === tech).map((j) => j.order_no))}. ${workloadInsight(count)}`
}

const cardShadow = { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.07)' }
const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all placeholder:text-gray-400'

const ManagerDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedJobs, setCompletedJobs] = useState<CompletedOrder[]>([])
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      const { data, error } = await supabase.from('orders')
        .select('order_no, assigned_technician, final_amount, status').eq('status', 'Job Done')
      if (cancelled) return
      if (error) { setError(error.message); setCompletedJobs([]) }
      else setCompletedJobs((data ?? []) as CompletedOrder[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const fetchTodayJobs = async (): Promise<CompletedOrder[]> => {
    const now = new Date(); const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    const { data, error } = await supabase.from('orders')
      .select('order_no, assigned_technician, final_amount, completed_at')
      .eq('status', 'Job Done').gte('completed_at', startOfToday.toISOString()).lt('completed_at', now.toISOString()).order('completed_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CompletedOrder[]
  }

  const fetchWeekJobs = async (): Promise<CompletedOrder[]> => {
    const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0)
    const { data, error } = await supabase.from('orders')
      .select('order_no, assigned_technician, final_amount, completed_at')
      .eq('status', 'Job Done').gte('completed_at', start.toISOString()).lt('completed_at', now.toISOString()).order('completed_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CompletedOrder[]
  }

  const fetchJobsByTechnician = async (technicianName: string): Promise<CompletedOrder[]> => {
    const tech = technicianName.trim(); if (!tech) return []
    const { data, error } = await supabase.from('orders')
      .select('order_no, assigned_technician, final_amount, completed_at')
      .eq('status', 'Job Done').eq('assigned_technician', tech).order('completed_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CompletedOrder[]
  }

  const kpis: TechnicianKpi[] = useMemo(() => {
    const byTech = new Map<string, TechnicianKpi>()
    for (const job of completedJobs) {
      const name = (job.assigned_technician || 'Unassigned').trim() || 'Unassigned'
      const amount = toMoneyNumber(job.final_amount)
      const current = byTech.get(name) ?? { name, jobsCompleted: 0, totalEarnings: 0 }
      current.jobsCompleted += 1; current.totalEarnings += amount
      byTech.set(name, current)
    }
    return Array.from(byTech.values()).sort((a, b) => b.jobsCompleted - a.jobsCompleted || b.totalEarnings - a.totalEarnings)
  }, [completedJobs])

  const askAi = async () => {
    const question = aiQuestion.trim(); if (!question) return
    setAiLoading(true); setAiError(null); setAiAnswer(null)
    try {
      const technicianNames = Array.from(new Set(completedJobs.map((j) => j.assigned_technician).filter((n): n is string => typeof n === 'string' && n.trim().length > 0)))
      const intentResult = interpretQuestion(question, technicianNames)
      let aiData: CompletedOrder[] = completedJobs
      if (intentResult?.intent === 'TODAY_JOBS') aiData = await fetchTodayJobs()
      else if (intentResult?.intent === 'WEEK_JOBS') aiData = await fetchWeekJobs()
      else if (intentResult?.intent === 'TOP_TECHNICIAN') aiData = await fetchWeekJobs()
      else if (intentResult?.intent === 'TECHNICIAN_JOBS' && typeof intentResult.technicianName === 'string')
        aiData = await fetchJobsByTechnician(intentResult.technicianName)
      setAiAnswer(formatAiResponse(intentResult, aiData))
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to call AI server')
    } finally { setAiLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#f5f4f1] px-4 py-8"
         style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(0,0,0,0.03), transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,0,0,0.03), transparent 50%)' }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Sejuk Sejuk Ops</p>
          <p className="text-2xl font-serif text-gray-900">Manager Dashboard</p>
          <p className="text-sm text-gray-500 mt-1">Overview of completed jobs and technician performance.</p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Completed Jobs', value: completedJobs.length },
            { label: 'Active Technicians', value: kpis.length },
            { label: 'Total Earnings', value: `RM ${kpis.reduce((sum, t) => sum + t.totalEarnings, 0).toFixed(2)}` },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-2xl p-5" style={cardShadow}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{kpi.label}</p>
              <p className="mt-2 text-2xl font-serif text-gray-900">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Technician Performance */}
        <div className="bg-white rounded-2xl p-6" style={cardShadow}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Technician Performance</p>
            {loading ? <span className="text-xs text-gray-400">Loading…</span> : null}
          </div>

          {kpis.length === 0 ? (
            <p className="text-sm text-gray-400 bg-[#f5f4f1] rounded-xl px-4 py-3">No completed jobs yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kpis.map((t) => (
                <div key={t.name} className="bg-[#f5f4f1] rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Jobs</p>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-3xl font-serif text-gray-900">{t.jobsCompleted}</p>
                    <p className="text-sm text-gray-500">RM {t.totalEarnings.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Query */}
        <div className="bg-white rounded-2xl p-6" style={cardShadow}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Operations AI Query</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">Ask a question about completed service jobs.</p>

          <div className="space-y-3">
            <input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void askAi()}
              placeholder="e.g. How many jobs did Ali complete?"
              className={inputClass} />

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => void askAi()}
                disabled={aiLoading || !aiQuestion.trim()}
                className="px-5 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-all text-sm font-medium">
                {aiLoading ? 'Analyzing…' : 'Ask →'}
              </button>
              <button type="button" disabled={aiLoading}
                onClick={() => { setAiQuestion(''); setAiAnswer(null); setAiError(null) }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-[#f5f4f1] disabled:opacity-40 transition-all text-sm">
                Clear
              </button>
            </div>

            <p className="text-xs text-gray-400">Try: "Jobs completed today" · "Top technician this week" · "Jobs by Ali"</p>

            {aiError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{aiError}</div>
            ) : null}

            {aiAnswer ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Response</p>
                <pre className="text-sm bg-[#f5f4f1] rounded-xl p-4 overflow-auto whitespace-pre-wrap text-gray-700">{aiAnswer}</pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerDashboard