import { Dialog, Transition } from '@headlessui/react'
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import { sendWhatsApp } from '../utils/helpers'

/**
 * Technician Portal (Service Job)
 */

type Order = {
  order_no: string
  customer_name?: string | null
  phone?: string | null
  address?: string | null
  problem_description?: string | null
  service_type?: string | null
  quoted_price?: number | string | null
  assigned_technician?: string | null
  completed_at?: string | null
  status?: string | null
  [key: string]: unknown
}

const STORAGE_BUCKET = 'technician-uploads'
const MAX_UPLOAD_FILES = 6

function toMoneyNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

const TechnicianDashboard = () => {
  const [technicianName, setTechnicianName] = useState('')

  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [assignedJobs, setAssignedJobs] = useState<Order[]>([])

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)

  const [savingCompletion, setSavingCompletion] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)

  // completion form state
  const [workDone, setWorkDone] = useState('')
  const [extraCharges, setExtraCharges] = useState('0')
  const [remarks, setRemarks] = useState('')
  const [uploads, setUploads] = useState<File[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  // payment recording
  const [recordPayment, setRecordPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank Transfer'>(
    'Cash',
  )
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null)

  const [timestampPreview, setTimestampPreview] = useState('')

  const finalAmount = useMemo(() => {
    if (!selectedOrder) return 0
    const base = toMoneyNumber(selectedOrder.quoted_price)
    const extra = toMoneyNumber(extraCharges)
    return base + extra
  }, [selectedOrder, extraCharges])

  const resetCompletionForm = () => {
    setWorkDone('')
    setExtraCharges('0')
    setRemarks('')
    setUploads([])
    setUploadError(null)

    setRecordPayment(false)
    setPaymentAmount('')
    setPaymentMethod('Cash')
    setReceiptPhoto(null)

    setCompletionError(null)
  }

  const loadAssignedJobs = async (name: string) => {
    const tech = name.trim()
    if (!tech) {
      setAssignedJobs([])
      setJobsError(null)
      return
    }

    setJobsLoading(true)
    setJobsError(null)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_technician', tech)

      if (error) throw error

      const rows = (data ?? []) as Order[]
      // Best-effort filtering of completed jobs (if fields exist)
      const notCompleted = rows.filter((j) => {
        const status = (j.status as string | undefined) ?? ''
        const completedAt = (j.completed_at as string | null | undefined) ?? null
        if (completedAt) return false
        if (status === 'Job Done') return false
        return true
      })

      setAssignedJobs(notCompleted)
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : 'Failed to load jobs')
    } finally {
      setJobsLoading(false)
    }
  }

  useEffect(() => {
    // keep in sync for better UX (only auto-load when name exists)
    if (technicianName.trim()) {
      void loadAssignedJobs(technicianName)
    } else {
      setAssignedJobs([])
      setJobsError(null)
    }
    // eslint-disable-next-line react-hooks
  }, [technicianName])

  const openCompletionForOrder = (order: Order) => {
    setSelectedOrder(order)
    setCompletionOpen(true)
    resetCompletionForm()
    setTimestampPreview(new Date().toISOString())

    // If payment is recorded, default amount to computed final amount
    setPaymentAmount(
      order.quoted_price != null ? String(toMoneyNumber(order.quoted_price)) : '',
    )
  }

  const handleUploadsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > MAX_UPLOAD_FILES) {
      setUploadError(`Please select up to ${MAX_UPLOAD_FILES} files.`)
      setUploads(files.slice(0, MAX_UPLOAD_FILES))
      return
    }
    setUploadError(null)
    setUploads(files)
  }

  const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    setReceiptPhoto(e.target.files?.[0] ?? null)
  }

  const uploadFilesAndGetUrls = async (orderNo: string, files: File[]) => {
    const timestamp = new Date().toISOString()
    const urls: string[] = []
    const paths: string[] = []

    for (const file of files) {
      const filePath = `order_${orderNo}/completion/${timestamp}/${file.name}`
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file)

      if (error) throw new Error(error.message)

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
      urls.push(data.publicUrl)
      paths.push(filePath)
    }

    return { urls, paths }
  }

  const handleCompleteJob = async (e: FormEvent) => {
    e.preventDefault()
    setCompletionError(null)

    if (!selectedOrder) {
      setCompletionError('No order selected.')
      return
    }

    const orderNo = selectedOrder.order_no
    const customerPhone = (selectedOrder.phone as string | null | undefined) ?? ''

    if (!workDone.trim()) {
      setCompletionError('Work Done is required.')
      return
    }

    if (uploads.length > MAX_UPLOAD_FILES) {
      setCompletionError(`Upload max is ${MAX_UPLOAD_FILES} files.`)
      return
    }

    if (recordPayment) {
      if (!paymentAmount.trim()) {
        setCompletionError('Payment amount is required when recording payment.')
        return
      }
    }

    setSavingCompletion(true)

    try {
      const completedAt = new Date().toISOString()
      const extra = toMoneyNumber(extraCharges)
      const base = toMoneyNumber(selectedOrder.quoted_price)
      const computedFinal = base + extra

      // Upload completion files
      const uploaded = await uploadFilesAndGetUrls(orderNo, uploads)

      // Upload receipt photo 
      let receiptUrl: string | null = null
      let receiptPath: string | null = null
      if (recordPayment && receiptPhoto) {
        const timestamp = new Date().toISOString()
        const filePath = `order_${orderNo}/payment/${timestamp}/${receiptPhoto.name}`
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, receiptPhoto)

        if (error) throw new Error(error.message)

        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
        receiptUrl = data.publicUrl
        receiptPath = filePath
      }

      // Save completion into orders
      const completionPayload = {
        status: 'Job Done',
        completed_at: completedAt,
        work_done: workDone.trim(),
        extra_charges: extra,
        final_amount: computedFinal,
        remarks: remarks.trim() || null,
        completion_file_urls: uploaded.urls,
        technician_name: technicianName.trim(),
        payment_amount: recordPayment ? Number(paymentAmount) : null,
        payment_method: recordPayment ? paymentMethod : null,
        payment_receipt_url: recordPayment ? receiptUrl : null,
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(completionPayload)
        .eq('order_no', orderNo)

      if (updateError) throw updateError

      // WhatsApp notify customer (best-effort)
      if (customerPhone) {
        const phone = normalizePhone(customerPhone)
        if (phone) {
          console.log('Completion uploads:', uploaded)
          if (receiptUrl) console.log('Receipt uploaded:', { receiptUrl, receiptPath })
          sendWhatsApp(
            phone,
            `Hi ${selectedOrder.customer_name ?? ''}, Job ${orderNo} has been completed by Technician ${technicianName.trim()} at ${completedAt}. Please check and leave feedback. Thank you!`,
          )
        }
      }

      // Notify manager/accounts (best-effort log)
      try {
        await supabase
          .from('orders')
          .update({ manager_notified_at: completedAt })
          .eq('order_no', orderNo)
      } catch {
        // ignore schema mismatch for now
      }

      setCompletionOpen(false)
      resetCompletionForm()
      setSelectedOrder(null)

      // Refresh jobs list
      if (technicianName.trim()) {
        void loadAssignedJobs(technicianName)
      }
    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : 'Completion failed')
    } finally {
      setSavingCompletion(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div className="rounded-xl bg-white border p-4">
          <h1 className="text-xl font-bold">Technician Portal</h1>
          <p className="text-sm text-gray-600 mt-1">
            View assigned jobs and submit service completion.
          </p>

          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium" htmlFor="tech-name">
              Technician Name
            </label>
            <input
              id="tech-name"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              placeholder="e.g. Ali"
            />
          </div>
        </div>

        {jobsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {jobsError}
          </div>
        ) : null}

        <div className="rounded-xl bg-white border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Assigned Jobs</h2>
            {jobsLoading ? <div className="text-sm text-gray-500">Loading…</div> : null}
          </div>

          <div className="mt-3 space-y-3">
            {assignedJobs.length === 0 ? (
              <div className="text-sm text-gray-500">
                {technicianName.trim()
                  ? 'No assigned jobs found.'
                  : 'Enter your technician name to load jobs.'}
              </div>
            ) : null}

            {assignedJobs.map((job) => (
              <div
                key={job.order_no}
                className="border rounded-lg p-3 space-y-2 bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">Order {job.order_no}</div>
                    <div className="text-sm text-gray-600">
                      {job.customer_name ? `Customer: ${job.customer_name}` : 'Customer: —'}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    Quoted: RM {toMoneyNumber(job.quoted_price)}
                  </div>
                </div>

                <div className="text-sm text-gray-700">
                  <div className="font-medium">
                    Service: {job.service_type ?? '—'}
                  </div>
                  <div className="text-gray-600">
                    {job.problem_description ?? 'No problem description'}
                  </div>
                </div>

                <button
                  className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  type="button"
                  onClick={() => openCompletionForOrder(job)}
                >
                  Complete Job
                </button>
              </div>
            ))}
          </div>
        </div>

        <Transition.Root show={completionOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={setCompletionOpen}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/30" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-end sm:items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-200"
                  enterFrom="opacity-0 translate-y-8 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-8 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white border p-4 sm:p-6">
                    <Dialog.Title className="text-lg font-semibold">
                      Service Completion
                    </Dialog.Title>

                    <form onSubmit={handleCompleteJob} className="mt-4 space-y-4">
                      {selectedOrder ? (
                        <>
                          <div className="space-y-1">
                            <label className="block text-sm font-medium">Order ID</label>
                            <input
                              readOnly
                              className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-800"
                              value={selectedOrder.order_no}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Work Done
                            </label>
                            <textarea
                              className="w-full border rounded-lg px-3 py-2 min-h-[110px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={workDone}
                              onChange={(e) => setWorkDone(e.target.value)}
                              placeholder="What was done? (summary)"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Extra Charges (RM)
                              </label>
                              <input
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                inputMode="decimal"
                                value={extraCharges}
                                onChange={(e) =>
                                  setExtraCharges(e.target.value.replace(/[^\d.]/g, ''))
                                }
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Final Amount (auto)
                              </label>
                              <input
                                readOnly
                                className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-800"
                                value={`RM ${finalAmount.toFixed(2)}`}
                              />
                            </div>
                          </div>

                          <div>
                              <label className="block text-sm font-medium mb-1">
                                Upload up to {MAX_UPLOAD_FILES} files
                              </label>
                            <input
                              type="file"
                              multiple
                              onChange={handleUploadsChange}
                              className="w-full"
                            />
                            {uploadError ? (
                              <div className="text-sm text-red-700 mt-1">{uploadError}</div>
                            ) : null}

                            {uploads.length ? (
                              <div className="text-xs text-gray-600 mt-2">
                                Selected: {uploads.map((f) => f.name).join(', ')}
                              </div>
                            ) : null}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Remarks
                            </label>
                            <textarea
                              className="w-full border rounded-lg px-3 py-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                              placeholder="Any extra remarks (optional)"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Technician Name
                              </label>
                              <input
                                readOnly
                                className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-800"
                                value={technicianName}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Timestamp
                              </label>
                              <input
                                readOnly
                                className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-800"
                                value={timestampPreview}
                              />
                            </div>
                          </div>

                          <div className="rounded-lg border bg-gray-50 p-3 space-y-3">
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <input
                                type="checkbox"
                                checked={recordPayment}
                                onChange={(e) => setRecordPayment(e.target.checked)}
                              />
                              Record payment (optional)
                            </label>

                            {recordPayment ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-sm font-medium mb-1">
                                      Amount (RM)
                                    </label>
                                    <input
                                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      inputMode="decimal"
                                      value={paymentAmount}
                                      onChange={(e) =>
                                        setPaymentAmount(
                                          e.target.value.replace(/[^\d.]/g, ''),
                                        )
                                      }
                                      placeholder={finalAmount.toFixed(2)}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium mb-1">
                                      Method
                                    </label>
                                    <select
                                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      value={paymentMethod}
                                      onChange={(e) =>
                                        setPaymentMethod(e.target.value as typeof paymentMethod)
                                      }
                                    >
                                      <option value="Cash">Cash</option>
                                      <option value="Card">Card</option>
                                      <option value="Bank Transfer">Bank Transfer</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium mb-1">
                                    Receipt photo (optional)
                                  </label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleReceiptChange}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {completionError ? (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                              {completionError}
                            </div>
                          ) : null}

                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              type="button"
                              className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
                              onClick={() => {
                                setCompletionOpen(false)
                                setSelectedOrder(null)
                                resetCompletionForm()
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingCompletion}
                              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
                            >
                              {savingCompletion ? 'Saving…' : 'Submit Completion'}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </form>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
      </div>
    </div>
  )
}

export default TechnicianDashboard
