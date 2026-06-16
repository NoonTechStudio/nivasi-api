// UPI payment handling — generate UPI deep link / QR for residents
export function generateUpiPaymentLink(params: {
  amount: number;
  billId: string;
  upiId: string;
  name: string;
}): string {
  const { amount, billId, upiId, name } = params;
  const note = encodeURIComponent(`Maintenance Bill ${billId}`);
  const payeeName = encodeURIComponent(name);
  return `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount}&tn=${note}&cu=INR`;
}
