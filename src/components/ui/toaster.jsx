import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastViewport,
} from "@/components/ui/toast";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDestructive = variant === "destructive";
        return (
          <Toast key={id} variant={variant} {...props} onClick={() => dismiss(id)}>
            {isDestructive
              ? <AlertCircle size={14} className="shrink-0 opacity-90" />
              : <CheckCircle2 size={14} className="shrink-0 text-[#C9A84C]" />
            }
            {description && <ToastDescription>{description}</ToastDescription>}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}