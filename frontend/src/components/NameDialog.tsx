import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorMsg } from './Loading';

interface NameDialogProps {
  open: boolean;
  title: string;
  placeholder: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function NameDialog({ open, title, placeholder, submitting, error, onSubmit, onClose }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <NameForm
          placeholder={placeholder}
          submitting={submitting}
          error={error}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

// Stan inputu zyje w komponencie wewnetrznym — DialogContent (Base UI Portal)
// odmontowuje sie przy zamknieciu, wiec nazwa resetuje sie sama, bez setState w efekcie.
function NameForm({ placeholder, submitting, error, onSubmit, onClose }: Omit<NameDialogProps, 'open' | 'title'>) {
  const [name, setName] = useState('');

  const submit = () => {
    if (submitting || !name.trim()) return;
    onSubmit(name);
  };

  return (
    <>
      <Input
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        autoFocus
      />
      {error && <ErrorMsg message={error} />}
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Anuluj</Button>
        <Button
          disabled={!name.trim() || submitting}
          onClick={submit}
        >
          Dodaj
        </Button>
      </DialogFooter>
    </>
  );
}
