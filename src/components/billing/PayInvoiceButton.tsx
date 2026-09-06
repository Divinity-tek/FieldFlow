import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PayInvoiceButtonProps {
  invoiceId: string;
  amount: number;
  currency?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline";
}

/**
 * Reusable "Pay Online" button. Currently shows a graceful info toast
 * because online payments require connecting a payment provider (e.g. Stripe).
 * Once enabled, swap this for a real checkout session creator.
 */
const PayInvoiceButton = ({ invoiceId, amount, size = "sm", variant = "default" }: PayInvoiceButtonProps) => {
  const handlePay = () => {
    toast.info("Online payments not enabled yet", {
      description: "Connect a payment provider (e.g. Stripe) to accept online invoice payments.",
      duration: 5000,
    });
  };
  return (
    <Button size={size} variant={variant} onClick={handlePay}>
      <CreditCard className="w-4 h-4 mr-2" />
      Pay Online
    </Button>
  );
};

export default PayInvoiceButton;
