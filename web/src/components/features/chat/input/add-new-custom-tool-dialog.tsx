import { installCustomTool } from '@/actions/tools';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import React, { useImperativeHandle, useState } from 'react';
import { toast } from 'sonner';

export interface AddNewCustomToolDialogRef {
  open: () => void;
}

export const AddNewCustomToolDialog = React.forwardRef<AddNewCustomToolDialogRef, { onSuccess?: () => void }>((props, ref) => {
  const [open, setOpen] = useState(false);

  const [toolName, setToolName] = useState('');
  const [toolConfig, setToolConfig] = useState('');

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
    },
  }));

  const handleAddTool = async () => {
    if (!toolName) {
      toast.error('Tool name is required');
      return;
    }
    if (!toolConfig) {
      toast.error('Tool config is required');
      return;
    }
    if (toolName && toolConfig) {
      const res = await installCustomTool({ name: toolName, config: toolConfig });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.data?.message || 'Tool installed successfully');
        setOpen(false);
        props.onSuccess?.();
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    setToolName('');
    setToolConfig('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={open => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent style={{ overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <DialogHeader className="h-12">
          <DialogTitle>Add a new custom tool</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4">
          <Input placeholder="Enter the tool name" value={toolName} onChange={e => setToolName(e.target.value)} />
          <Textarea
            placeholder={`Enter the tool config, example:\n{\n    "command": "npx",\n    "args": ["-y", "@modelcontextprotocol/server-everything"]\n}`}
            value={toolConfig}
            onChange={e => setToolConfig(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleAddTool}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
