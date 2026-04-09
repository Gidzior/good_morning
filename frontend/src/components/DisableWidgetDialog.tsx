import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DisableWidgetDialogProps {
  open: boolean;
  widgetName: string;
  onKeepData: () => void;
  onDeleteData: () => void;
  onCancel: () => void;
}

export default function DisableWidgetDialog({
  open,
  widgetName,
  onKeepData,
  onDeleteData,
  onCancel,
}: DisableWidgetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Wyłącz widget</DialogTitle>
          <DialogDescription>
            Jak chcesz wyłączyć <strong>{widgetName}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={onKeepData} className="justify-start">
            Ukryj (zachowaj dane)
          </Button>
          <Button variant="destructive" onClick={onDeleteData} className="justify-start">
            Ukryj i usun dane
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Anuluj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
