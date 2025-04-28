'use client';

import { listAgents } from '@/actions/agents';
import { removeLlmConfig } from '@/actions/config';
import { confirm } from '@/components/block/confirm';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServerAction } from '@/hooks/use-async';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { ConfigDialog, ConfigDialogRef } from './config-dialog';

export type AgentData = NonNullable<Awaited<ReturnType<typeof listAgents>>['data']>[number];

export default function ConfigLlm() {
  const { data: agents, refresh: refreshAgents } = useServerAction(listAgents, {});
  const configDialogRef = useRef<ConfigDialogRef>(null);

  const handleAddNew = () => {
    configDialogRef.current?.open();
  };

  const handleEdit = (agent: AgentData) => {
    configDialogRef.current?.open(agent);
  };

  const handleDelete = (config: AgentData) => {
    confirm({
      content: 'Are you sure you want to remove this model?',
      onConfirm: async () => {
        if (config.id) {
          await removeLlmConfig({ id: config.id });
          refreshAgents();
          toast.success('Model removed');
        }
      },
      buttonText: {
        confirm: 'Remove',
        cancel: 'Cancel',
        loading: 'Removing...',
      },
    });
  };

  return (
    <>
      <DialogHeader className="mb-2">
        <DialogTitle>Agents</DialogTitle>
        <DialogDescription>Configure your agents</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={handleAddNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Agent
          </Button>
        </div>
        <div className="grid gap-4">
          {agents?.map(agent => (
            <div key={agent.id} className="flex items-center justify-between rounded-lg border p-4 shadow-sm transition-all hover:shadow-md">
              <div className="flex flex-col gap-1">
                <div className="font-medium">{agent.name}</div>
                <div className="text-muted-foreground text-sm">{agent.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(agent)} className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(agent)} className="flex items-center gap-2">
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfigDialog ref={configDialogRef} onSuccess={refreshAgents} />
    </>
  );
}
