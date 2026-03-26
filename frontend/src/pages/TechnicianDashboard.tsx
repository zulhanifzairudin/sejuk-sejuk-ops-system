import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { sendWhatsApp } from '../utils/helpers'

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
  if (typeof value === 'string') { const n = Number(value); return Number.isFinite(n) ? n : 0 }
  return 0
}

function normalizePhone(phone: string) { return phone.replace(/\D/g, '') }

const cardShadow = { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.07)' }
const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition-all placeholder:text-gray-400'
const labelClass = 'block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1.5'
const readonlyClass = 'w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-[#f5f4f1] text-gray-600'

const TechnicianDashboard = () => {
  const [technicianName, setTechnicianName] = useState('')
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [assignedJobs, setAssignedJobs] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [savingCompletion, setSavingCompletion] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [workDone, setWorkDone] = useState('')
  const [extraCharges, setExtraCharges] = useState('0')
  const [remarks, setRemarks] = useState('')
  const [uploads, setUploads] = useState<File[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [recordPayment, setRecordPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank Transfer'>('Cash')
  const [receiptPhoto, setReceiptPhoto] = useState<File | null>(null)
  const [timestampPreview, setTimestampPreview] = useState('')

  const finalAmount = useMemo(() => {
    if (!selectedOrder) return 0
    return toMoneyNumber(selectedOrder.quoted_price) + toMoneyNumber(extraCharges)
  }, [selectedOrder, extraCharges])

  const resetCompletionForm = () => {
    setWorkDone(''); setExtraCharges('0'); setRemarks(''); setUploads([]); setUploadError(null)
    setRecordPayment(false); setPaymentAmount(''); setPaymentMethod('Cash'); setReceiptPhoto(null); setCompletionError(null)
  }

  const loadAssignedJobs = async (name: string) => {
    const tech = name.trim()
    if (!tech) { setAssignedJobs([]); setJobsError(null); return }
    setJobsLoading(true); setJobsError(null)
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('assigned_technician', tech)
      if (error) throw error
      setAssignedJobs(((data ?? []) as Order[]).filter((j) => {
        const status = (j.status as string | undefined) ?? ''
        const completedAt = (j.completed_at as string | null | undefined) ?? null
        return !completedAt && status !== 'Job Done'
      }))
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : 'Failed to load jobs')
    } finally { setJobsLoading(false) }
  }

  useEffect(() => {
    if (technicianName.trim()) void loadAssignedJobs(technicianName)
    else { setAssignedJobs([]); setJobsError(null) }
  }, [technicianName])

  const openCompletionForOrder = (order: Order) => {
    setSelectedOrder(order); setCompletionOpen(true); resetCompletionForm()
    setTimestampPreview(new Date().toISOString())
    setPaymentAmount(order.quoted_price != null ? String(toMoneyNumber(order.quoted_price)) : '')
  }

  const handleUploadsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > MAX_UPLOAD_FILES) { setUploadError(`Max ${MAX_UPLOAD_FILES} files.`); setUploads(files.slice(0, MAX_UPLOAD_FILES)); return }
    setUploadError(null); setUploads(files)
  }

  const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => { setReceiptPhoto(e.target.files?.[0] ?? null) }

  const uploadFilesAndGetUrls = async (orderNo: string, files: File[]) => {
    const timestamp = new Date().toISOString(); const urls: string[] = []; const paths: string[] = []
    for (const file of files) {
      const filePath = `order_${orderNo}/completion/${timestamp}/${file.name}`
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file)
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
      urls.push(data.publicUrl); paths.push(filePath)
    }
    return { urls, paths }
  }

  const handleCompleteJob = async (e: FormEvent) => {
    e.preventDefault(); setCompletionError(null)
    if (!selectedOrder) { setCompletionError('No order selected.'); return }
    if (!workDone.trim()) { setCompletionError('Work Done is required.'); return }
    if (uploads.length > MAX_UPLOAD_FILES) { setCompletionError(`Max ${MAX_UPLOAD_FILES} files.`); return }
    if (recordPayment && !paymentAmount.trim()) { setCompletionError('Payment amount is required.'); return }
    setSavingCompletion(true)
    try {
      const completedAt = new Date().toISOString()
      const extra = toMoneyNumber(extraCharges)
      const base = toMoneyNumber(selectedOrder.quoted_price)
      const uploaded = await uploadFilesAndGetUrls(selectedOrder.order_no, uploads)
      let receiptUrl: string | null = null
      if (recordPayment && receiptPhoto) {
        const filePath = `order_${selectedOrder.order_no}/payment/${completedAt}/${receiptPhoto.name}`
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, receiptPhoto)
        if (error) throw new Error(error.message)
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
        receiptUrl = data.publicUrl
      }
      const completionPayload: Record<string, unknown> = {
        status: 'Job Done', completed_at: completedAt, work_done: workDone.trim(),
        extra_charges: extra, final_amount: base + extra, remarks: remarks.trim() || null,
        completion_file_urls: uploaded.urls,
        ...(recordPayment ? { payment_amount: Number(paymentAmount), payment_method: paymentMethod, payment_receipt_url: receiptUrl } : {}),
      }
      const { error: updateError } = await supabase.from('orders').update(completionPayload).eq('order_no', selectedOrder.order_no)
      if (updateError) throw updateError
      const customerPhone = (selectedOrder.phone as string | null | undefined) ?? ''
      if (customerPhone) {
        const phone = normalizePhone(customerPhone)
        if (phone) sendWhatsApp(phone, `Hi ${selectedOrder.customer_name ?? ''}, Job ${selectedOrder.order_no} has been completed by Technician ${technicianName.trim()} at ${completedAt}. Thank you!`)
      }
      try { await supabase.from('orders').update({ manager_notified_at: completedAt }).eq('order_no', selectedOrder.order_no) } catch { /* ignore */ }
      setCompletionOpen(false); resetCompletionForm(); setSelectedOrder(null)
      if (technicianName.trim()) void loadAssignedJobs(technicianName)
    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : 'Completion failed')
    } finally { setSavingCompletion(false) }
  }

  return (
    <div className="min-h-screen bg-[#f5f4f1] px-4 py-8"
         style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(0,0,0,0.03), transparent 50%), radial-gradient(circle at 80% 20%, rgba(0,0,0,0.03), transparent 50%)' }}>
      <div className="max-w-md mx-auto space-y-5">

        {/* Header card */}
        <div className="bg-white rounded-2xl p-6" style={cardShadow}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Sejuk Sejuk Ops</p>
          <p className="text-2xl font-serif text-gray-900">Technician Portal</p>
          <p className="text-sm text-gray-500 mt-1">View assigned jobs and submit service completion.</p>

          <div className="mt-5">
            <label className={labelClass} htmlFor="tech-name">Your Name</label>
            <input id="tech-name" className={inputClass} value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)} placeholder="e.g. Ali" />
          </div>
        </div>

        {jobsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{jobsError}</div>
        ) : null}

        {/* Jobs list */}
        <div className="bg-white rounded-2xl p-6" style={cardShadow}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Assigned Jobs</p>
            {jobsLoading ? <span className="text-xs text-gray-400">Loading…</span> : null}
          </div>

          <div className="space-y-3">
            {assignedJobs.length === 0 ? (
              <p className="text-sm text-gray-400 bg-[#f5f4f1] rounded-xl px-4 py-3">
                {technicianName.trim() ? 'No assigned jobs found.' : 'Enter your name to load jobs.'}
              </p>
            ) : null}

            {assignedJobs.map((job) => (
              <div key={job.order_no} className="bg-[#f5f4f1] rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Order {job.order_no}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{job.customer_name ? `Customer: ${job.customer_name}` : 'Customer: —'}</p>
                  </div>
                  <p className="text-xs text-gray-500 text-right">RM {toMoneyNumber(job.quoted_price)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{job.service_type ?? '—'}</p>
                  <p className="text-sm text-gray-600 mt-1">{job.problem_description ?? 'No description'}</p>
                </div>
                <button type="button"
                  className="w-full flex items-center justify-between bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-all"
                  onClick={() => openCompletionForOrder(job)}>
                  Complete Job <span className="opacity-50">→</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Completion Modal */}
        <Transition.Root show={completionOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={setCompletionOpen}>
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
            </Transition.Child>
            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-end sm:items-center justify-center p-4">
                <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-8 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-8 sm:translate-y-0 sm:scale-95">
                  <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6" style={cardShadow}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Service Completion</p>
                    <Dialog.Title className="text-xl font-serif text-gray-900 mb-5">Submit Completion</Dialog.Title>

                    <form onSubmit={handleCompleteJob} className="space-y-4">
                      {selectedOrder ? (
                        <>
                          <div>
                            <label className={labelClass}>Order ID</label>
                            <input readOnly className={readonlyClass} value={selectedOrder.order_no} />
                          </div>

                          <div>
                            <label className={labelClass}>Work Done</label>
                            <textarea className={inputClass + ' min-h-[110px] resize-none'} value={workDone}
                              onChange={(e) => setWorkDone(e.target.value)} placeholder="What was done?" required />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Extra Charges (RM)</label>
                              <input className={inputClass} inputMode="decimal" value={extraCharges}
                                onChange={(e) => setExtraCharges(e.target.value.replace(/[^\d.]/g, ''))} />
                            </div>
                            <div>
                              <label className={labelClass}>Final Amount</label>
                              <input readOnly className={readonlyClass} value={`RM ${finalAmount.toFixed(2)}`} />
                            </div>
                          </div>

                          <div>
                            <label className={labelClass}>Upload up to {MAX_UPLOAD_FILES} files</label>
                            <input type="file" multiple onChange={handleUploadsChange} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800" />
                            {uploadError ? <p className="text-xs text-red-600 mt-1">{uploadError}</p> : null}
                            {uploads.length ? <p className="text-xs text-gray-400 mt-1">{uploads.map((f) => f.name).join(', ')}</p> : null}
                          </div>

                          <div>
                            <label className={labelClass}>Remarks</label>
                            <textarea className={inputClass + ' min-h-[80px] resize-none'} value={remarks}
                              onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Technician</label>
                              <input readOnly className={readonlyClass} value={technicianName} />
                            </div>
                            <div>
                              <label className={labelClass}>Timestamp</label>
                              <input readOnly className={readonlyClass} value={timestampPreview} />
                            </div>
                          </div>

                          <div className="rounded-xl bg-[#f5f4f1] p-4 space-y-3">
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={recordPayment} onChange={(e) => setRecordPayment(e.target.checked)} className="rounded" />
                              <span className="font-medium">Record payment</span>
                              <span className="text-gray-400">(optional)</span>
                            </label>
                            {recordPayment ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={labelClass}>Amount (RM)</label>
                                    <input className={inputClass} inputMode="decimal" value={paymentAmount}
                                      onChange={(e) => setPaymentAmount(e.target.value.replace(/[^\d.]/g, ''))}
                                      placeholder={finalAmount.toFixed(2)} />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Method</label>
                                    <select className={inputClass} value={paymentMethod}
                                      onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                                      <option value="Cash">Cash</option>
                                      <option value="Card">Card</option>
                                      <option value="Bank Transfer">Bank Transfer</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className={labelClass}>Receipt photo (optional)</label>
                                  <input type="file" accept="image/*" onChange={handleReceiptChange}
                                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-900 file:text-white hover:file:bg-gray-800" />
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {completionError ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{completionError}</div>
                          ) : null}

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button type="button"
                              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-[#f5f4f1] transition-all text-sm"
                              onClick={() => { setCompletionOpen(false); setSelectedOrder(null); resetCompletionForm() }}>
                              Cancel
                            </button>
                            <button type="submit" disabled={savingCompletion}
                              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-all text-sm font-medium">
                              {savingCompletion ? 'Saving…' : 'Submit →'}
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