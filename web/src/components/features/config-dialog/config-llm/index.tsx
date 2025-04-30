'use client';

import { getLlmConfigs, removeLlmConfig } from '@/actions/config';
import { confirm } from '@/components/block/confirm';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useServerAction } from '@/hooks/use-async';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { ConfigDialog, ConfigDialogRef } from './config-dialog';
import { useTranslations } from 'next-intl';

export interface ConfigFormData {
  id?: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  apiType: string;
}

export default function ConfigLlm() {
  const t = useTranslations('config.llm');
  const { data: configs, refresh: refreshConfigs } = useServerAction(getLlmConfigs, {});
  const configDialogRef = useRef<ConfigDialogRef>(null);

  const handleAddNew = () => {
    configDialogRef.current?.open();
  };

  const handleEdit = (config: ConfigFormData) => {
    configDialogRef.current?.open(config);
  };

  const handleDelete = (config: ConfigFormData) => {
    confirm({
      content: t('confirmDelete'),
      onConfirm: async () => {
        if (config.id) {
          await removeLlmConfig({ id: config.id });
          refreshConfigs();
          toast.success(t('modelRemoved'));
        }
      },
      buttonText: {
        confirm: t('remove'),
        cancel: t('cancel'),
        loading: t('removing'),
      },
    });
  };

  return (
    <>
      <DialogHeader className="mb-2">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('description')}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={handleAddNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('addNew')}
          </Button>
        </div>
        <div className="grid gap-4">
          {configs?.map(config => (
            <div key={config.id} className="flex items-center justify-between rounded-lg border p-4 shadow-sm transition-all hover:shadow-md">
              <div className="flex flex-col gap-1">
                <div className="font-medium">{config.model}</div>
                <div className="text-muted-foreground text-sm">{config.baseUrl}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(config)} className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(config)} className="flex items-center gap-2">
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfigDialog ref={configDialogRef} onSuccess={refreshConfigs} />
    </>
  );
}
