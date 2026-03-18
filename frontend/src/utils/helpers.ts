/**
 * send WA message to a phone number using deep link
 * @param phone - recipient number (e.g.: "60123456789")
 * @param message - text message to send
 */
export const sendWhatsApp = (phone: string, message: string) => {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank') // opens WA in new tab or mobile app
}

