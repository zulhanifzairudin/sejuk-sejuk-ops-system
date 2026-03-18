import { type FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

const TechnicianDashboard = () => {
  const [orderId, setOrderId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus(null)

    if (!orderId) {
      setStatus('Please enter an order ID.')
      return
    }

    if (!file) {
      setStatus('Please choose a file to upload.')
      return
    }

    const { data, error } = await supabase.storage
      .from('technician-uploads')
      .upload(`order_${orderId}/${file.name}`, file)

    if (error) {
      console.error(error)
      setStatus(`Upload failed: ${error.message}`)
    } else {
      setStatus(`Upload successful: ${data?.path ?? ''}`)
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Technician Dashboard</h1>

      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="order-id">
            Order ID
          </label>
          <input
            id="order-id"
            type="text"
            className="border rounded px-2 py-1 w-full"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="file">
            File
          </label>
          <input
            id="file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
          disabled={!orderId || !file}
        >
          Upload File
        </button>
      </form>

      {status && <p className="mt-3 text-sm">{status}</p>}
    </div>
  )
}

export default TechnicianDashboard
