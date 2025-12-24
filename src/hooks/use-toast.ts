import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const message = options.title || options.description || "";
    const description = options.title ? options.description : undefined;

    if (options.variant === "destructive") {
      sonnerToast.error(message, {
        description,
        duration: options.duration || 5000,
      });
    } else {
      sonnerToast.success(message, {
        description,
        duration: options.duration || 5000,
      });
    }
  };

  return { toast };
}

export { sonnerToast as toast };
