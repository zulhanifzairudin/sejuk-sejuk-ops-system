import { supabase } from '../lib/supabase'

interface Props {
  orderId: string
}

export const FileUploader = ({ orderId }: Props) => {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return

    const file = e.target.files[0]
    const { data, error } = await supabase.storage
      .from('technician-uploads')
      .upload(`order_${orderId}/${file.name}`, file)

    if (error) console.error(error)
    else console.log('File uploaded:', data)
  }

  return <input type="file" onChange={handleUpload} />
}

