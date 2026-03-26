import { Listbox } from '@headlessui/react'
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendWhatsApp } from '../utils/helpers'

type TechnicianOption = { name: string; phone?: string | null }
const technicianOptions: TechnicianOption[] = [
  { name: 'Ali', phone: '60123450001' },
  { name: 'John', phone: '60123450002' },
  { name: 'Bala', phone: '60123450003' },
  { name: 'Yusoff', phone: '60123450004' },
]

const serviceTypes = ['Maintenance', 'Repair', 'Installation', 'Inspection', 'Other'] as const
type ServiceType = (typeof serviceTypes)[number]

type CreateOrderInput = {
  orderNo: string
  customerName: string
  customerPhone: string
  address: string
  problemDescription: string
  serviceType: ServiceType
  quotedPrice: string
  assignedTechnician: TechnicianOption | null
  adminNotes: string
}

const generateOrderNo = () => `ORDER${Date.now()}`

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all placeholder:text-gray-400'

const labelClass = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'

const AdminDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdOrder, setCreatedOrder] = useState<Record<string, unknown> | null>(null)

  const [form, setForm] = useState<CreateOrderInput>(() => ({
    orderNo: generateOrderNo(),
    customerName: '',
    customerPhone: '',
    address: '',
    problemDescription: '',
    serviceType: 'Maintenance',
    quotedPrice: '',
    assignedTechnician: null,
    adminNotes: '',
  }))

  const canSubmit = useMemo(() => {
    return (
      form.customerName.trim() &&
      form.customerPhone.trim() &&
      form.address.trim() &&
      form.problemDescription.trim() &&
      form.serviceType &&
      !loading
    )
  }, [form, loading])

  const resetForm = () => {
    setForm({
      orderNo: generateOrderNo(),
      customerName: '',
      customerPhone: '',
      address: '',
      problemDescription: '',
      serviceType: 'Maintenance',
      quotedPrice: '',
      assignedTechnician: null,
      adminNotes: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreatedOrder(null)
    setLoading(true)

    const payload = {
      order_no: form.orderNo,
      customer_name: form.customerName.trim(),
      phone: form.customerPhone.trim(),
      address: form.address.trim(),
      problem_description: form.problemDescription.trim(),
      service_type: form.serviceType,
      quoted_price: form.quotedPrice ? Number(form.quotedPrice) : null,
      assigned_technician: form.assignedTechnician?.name ?? null,
      admin_notes: form.adminNotes.trim() || null,
      status: 'Assigned',
    }

    const { data, error } = await supabase.from('orders').insert(payload).select('*')

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const inserted = (data?.[0] ?? payload) as Record<string, unknown>
    setCreatedOrder(inserted)
    setLoading(false)

    const techPhone = form.assignedTechnician?.phone?.replace(/\D/g, '') ?? ''
    if (techPhone) sendWhatsApp(techPhone, `Job ${form.orderNo} assigned to you`)

    resetForm()
  }

  return (
    <div className="min-h-screen bg-[#f5f4f1] px-4 py-8"
         style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(0,0,0,0.03), transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,0,0,0.03), transparent 50%)' }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Sejuk Sejuk Ops</p>
            <p className="text-2xl font-serif text-gray-900">Admin Portal</p>
            <p className="text-sm text-gray-500 mt-1">Create a new service order and assign a technician.</p>
          </div>
          <div className="bg-white rounded-2xl px-5 py-3.5"
               style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Order No</p>
            <p className="font-mono text-sm text-gray-800 mt-0.5">{form.orderNo}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}
                  className="bg-white rounded-2xl p-6 space-y-5"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.07)' }}>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Customer Name</label>
                  <input className={inputClass} value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                    placeholder="e.g. Ahmad" required />
                </div>
                <div>
                  <label className={labelClass}>Phone (WhatsApp)</label>
                  <input className={inputClass} value={form.customerPhone}
                    onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                    placeholder='e.g. "60123456789"' required />
                </div>
              </div>

              <div>
                <label className={labelClass}>Address</label>
                <textarea className={inputClass + ' min-h-[80px] resize-none'} value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Full address" required />
              </div>

              <div>
                <label className={labelClass}>Problem Description</label>
                <textarea className={inputClass + ' min-h-[110px] resize-none'} value={form.problemDescription}
                  onChange={(e) => setForm((f) => ({ ...f, problemDescription: e.target.value }))}
                  placeholder="Describe the issue" required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Service Type</label>
                  <Listbox value={form.serviceType} onChange={(value) => setForm((f) => ({ ...f, serviceType: value }))}>
                    <div className="relative">
                      <Listbox.Button className={inputClass + ' text-left'}>{form.serviceType}</Listbox.Button>
                      <Listbox.Options className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
                        {serviceTypes.map((t) => (
                          <Listbox.Option key={t} value={t}
                            className="cursor-pointer px-3 py-2 text-sm hover:bg-[#f5f4f1] ui-selected:font-medium">
                            {t}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>

                <div>
                  <label className={labelClass}>Quoted Price (RM)</label>
                  <input className={inputClass} value={form.quotedPrice}
                    onChange={(e) => setForm((f) => ({ ...f, quotedPrice: e.target.value.replace(/[^\d.]/g, '') }))}
                    inputMode="decimal" placeholder="e.g. 120" />
                </div>

                <div>
                  <label className={labelClass}>Assigned Technician</label>
                  <Listbox value={form.assignedTechnician} onChange={(value) => setForm((f) => ({ ...f, assignedTechnician: value }))}>
                    <div className="relative">
                      <Listbox.Button className={inputClass + ' text-left'}>
                        {form.assignedTechnician?.name ?? 'Select technician'}
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
                        <Listbox.Option value={null} className="cursor-pointer px-3 py-2 text-sm hover:bg-[#f5f4f1]">Unassigned</Listbox.Option>
                        {technicianOptions.map((t) => (
                          <Listbox.Option key={t.name} value={t} className="cursor-pointer px-3 py-2 text-sm hover:bg-[#f5f4f1] ui-selected:font-medium">
                            <div className="flex items-center justify-between gap-2">
                              <span>{t.name}</span>
                              {t.phone ? <span className="text-xs text-gray-400">{t.phone}</span> : null}
                            </div>
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>
              </div>

              <div>
                <label className={labelClass}>Admin Notes</label>
                <textarea className={inputClass + ' min-h-[90px] resize-none'} value={form.adminNotes}
                  onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
                  placeholder="Internal notes (optional)" />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button type="button"
                  onClick={() => { setError(null); setCreatedOrder(null); resetForm() }}
                  className="text-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-[#f5f4f1] transition-all">
                  Reset
                </button>
                <button type="submit" disabled={!canSubmit}
                  className="text-sm px-5 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-all font-medium">
                  {loading ? 'Saving…' : 'Submit Order →'}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-6"
                 style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.07)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">After Submission</p>
              <p className="text-sm text-gray-500 mt-1">Order summary will appear here. WhatsApp opens automatically if technician has a number.</p>

              <div className="mt-4">
                {createdOrder ? (
                  <pre className="text-xs bg-[#f5f4f1] rounded-xl p-3 overflow-auto text-gray-700">
                    {JSON.stringify(createdOrder, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-gray-400 bg-[#f5f4f1] rounded-xl px-4 py-3">No order submitted yet.</div>
                )}
              </div>

              <div className="mt-4 rounded-xl bg-[#f5f4f1] p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">WhatsApp Link Preview</p>
                <p className="text-xs text-gray-500 mt-1 break-all">
                  {`https://wa.me/<phone>?text=${encodeURIComponent(`Job ${form.orderNo} assigned to you`)}`}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard