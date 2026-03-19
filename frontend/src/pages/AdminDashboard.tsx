import { Listbox } from '@headlessui/react'
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendWhatsApp } from '../utils/helpers'

type TechnicianOption = {
  name: string
  phone?: string | null
}

const technicianOptions: TechnicianOption[] = [
  { name: 'Ali', phone: '60123450001' },
  { name: 'John', phone: '60123450002' },
  { name: 'Bala', phone: '60123450003' },
  { name: 'Yusoff', phone: '60123450004' },
]

const serviceTypes = [
  'Maintenance',
  'Repair',
  'Installation',
  'Inspection',
  'Other',
] as const

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

const AdminDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdOrder, setCreatedOrder] = useState<Record<string, unknown> | null>(
    null,
  )

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

    //WhatsApp notify technician (if phone exists)
    const techPhone = form.assignedTechnician?.phone?.replace(/\D/g, '') ?? ''
    if (techPhone) {
      sendWhatsApp(techPhone, `Job ${form.orderNo} assigned to you`)
    }

    resetForm()
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Portal</h1>
            <p className="text-sm text-gray-600 mt-1">
              Create a new service order and assign a technician.
            </p>
          </div>
          <div className="rounded-lg bg-white border px-4 py-3">
            <div className="text-xs text-gray-500">Order No</div>
            <div className="font-mono text-sm">{form.orderNo}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              className="bg-white border rounded-xl p-4 md:p-6 space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Customer Name
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.customerName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customerName: e.target.value }))
                    }
                    placeholder="e.g. Ahmad"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Phone (WhatsApp)
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.customerPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customerPhone: e.target.value }))
                    }
                    placeholder='e.g. "60123456789"'
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Full address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Problem Description
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 min-h-[110px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.problemDescription}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, problemDescription: e.target.value }))
                  }
                  placeholder="Describe the issue"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Service Type
                  </label>
                  <Listbox
                    value={form.serviceType}
                    onChange={(value) => setForm((f) => ({ ...f, serviceType: value }))}
                  >
                    <div className="relative">
                      <Listbox.Button className="w-full border rounded-lg px-3 py-2 text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {form.serviceType}
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-sm max-h-60 overflow-auto">
                        {serviceTypes.map((t) => (
                          <Listbox.Option
                            key={t}
                            value={t}
                            className="cursor-pointer px-3 py-2 text-sm ui-active:bg-blue-50 ui-selected:font-medium"
                          >
                            {t}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Quoted Price (RM)
                  </label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.quotedPrice}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        quotedPrice: e.target.value.replace(/[^\d.]/g, ''),
                      }))
                    }
                    inputMode="decimal"
                    placeholder="e.g. 120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Assigned Technician
                  </label>
                  <Listbox
                    value={form.assignedTechnician}
                    onChange={(value) =>
                      setForm((f) => ({ ...f, assignedTechnician: value }))
                    }
                  >
                    <div className="relative">
                      <Listbox.Button className="w-full border rounded-lg px-3 py-2 text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {form.assignedTechnician?.name ?? 'Select technician'}
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-sm max-h-60 overflow-auto">
                        <Listbox.Option
                          value={null}
                          className="cursor-pointer px-3 py-2 text-sm ui-active:bg-blue-50 ui-selected:font-medium"
                        >
                          Unassigned
                        </Listbox.Option>
                        {technicianOptions.map((t) => (
                          <Listbox.Option
                            value={t}
                            className="cursor-pointer px-3 py-2 text-sm ui-active:bg-blue-50 ui-selected:font-medium"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{t.name}</span>
                              {t.phone ? (
                                <span className="text-xs text-gray-500">{t.phone}</span>
                              ) : null}
                            </div>
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Admin Notes</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.adminNotes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, adminNotes: e.target.value }))
                  }
                  placeholder="Internal notes (optional)"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setCreatedOrder(null)
                    resetForm()
                  }}
                  className="text-sm px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:hover:bg-blue-600"
                >
                  {loading ? 'Saving…' : 'Submit Order'}
                </button>
              </div>
            </form>
          </div>

          <aside className="lg:col-span-1">
            <div className="bg-white border rounded-xl p-4 md:p-6">
              <h2 className="text-lg font-semibold">After submission</h2>
              <p className="text-sm text-gray-600 mt-1">
                You’ll see an order summary here. If the selected technician has a
                phone number, WhatsApp will open automatically.
              </p>

              <div className="mt-4">
                {createdOrder ? (
                  <pre className="text-xs bg-gray-50 border rounded-lg p-3 overflow-auto">
                    {JSON.stringify(createdOrder, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-gray-500">
                    No order submitted yet.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-medium text-gray-700">
                  WhatsApp deep-link example
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {`https://wa.me/<phone>?text=${encodeURIComponent(
                    `Job ${form.orderNo} assigned to you`,
                  )}`}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
