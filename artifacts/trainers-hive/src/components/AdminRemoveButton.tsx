import React from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  label: string;
  description: string;
  variant?: "icon" | "full";
  onConfirm: () => Promise<void>;
  successMessage?: string;
  className?: string;
};

export function AdminRemoveButton({
  label,
  description,
  variant = "icon",
  onConfirm,
  successMessage,
  className,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    try {
      await onConfirm();
      toast({
        title: "Removed",
        description: successMessage ?? `${label} has been removed.`,
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: "Could not remove",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={
              "h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 " +
              (className ?? "")
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label={`Remove ${label}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className={
              "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive " +
              (className ?? "")
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Remove {label}?
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing
              </>
            ) : (
              "Yes, remove"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
