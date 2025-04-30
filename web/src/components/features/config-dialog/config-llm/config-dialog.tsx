'use client';

import { updateLlmConfig } from '@/actions/config';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import Link from 'next/link';
import React, { useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ConfigFormData } from '.';
import { useTranslations } from 'next-intl';

interface ConfigDialogProps {
  onSuccess?: (success: boolean) => void;
}

export interface ConfigDialogRef {
  open: (config?: ConfigFormData) => void;
}

export const ConfigDialog = React.forwardRef<ConfigDialogRef, ConfigDialogProps>((props, ref) => {
  const t = useTranslations('config.llm');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    open: (config?: ConfigFormData) => {
      form.reset(config);
      setOpen(true);
    },
  }));

  const form = useForm<ConfigFormData>({
    defaultValues: {
      model: 'deepseek-chat',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com/v1',
      maxTokens: 8192,
      temperature: 0.7,
      apiType: 'openai',
    },
    resolver: async data => {
      const errors: any = {};

      if (!data.model) {
        errors.model = {
          type: 'required',
          message: t('required'),
        };
      }

      if (!data.apiKey) {
        errors.apiKey = {
          type: 'required',
          message: t('required'),
        };
      }

      if (!data.baseUrl) {
        errors.baseUrl = {
          type: 'required',
          message: t('required'),
        };
      }

      return {
        values: data,
        errors,
      };
    },
  });

  const onSubmit = async (data: ConfigFormData) => {
    try {
      setLoading(true);
      await updateLlmConfig({ ...data, id: data.id || undefined });
      toast.success(t('configUpdated'));
      props.onSuccess?.(true);
      setOpen(false);
    } catch (error) {
      toast.error(t('configUpdateError'));
      props.onSuccess?.(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent>
          <DialogHeader className="mb-2">
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="model" className="flex items-center gap-1">
                      {t('model')}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input id="model" {...field} placeholder="e.g. deepseek-chat" />
                    {form.formState.errors.model && <p className="text-sm text-red-500">{form.formState.errors.model.message}</p>}
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="flex items-center gap-1">
                      {t('apiKey')}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input id="apiKey" {...field} placeholder={t('apiKeyPlaceholder')} />
                    {form.formState.errors.apiKey && <p className="text-sm text-red-500">{form.formState.errors.apiKey.message}</p>}
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl" className="flex items-center gap-1">
                      {t('baseUrl')}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input id="baseUrl" {...field} placeholder={t('baseUrlPlaceholder')} />
                    {form.formState.errors.baseUrl && <p className="text-sm text-red-500">{form.formState.errors.baseUrl.message}</p>}
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="maxTokens"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">{t('maxTokens')}</Label>
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <Slider min={1} max={8192} step={1} value={[field.value]} onValueChange={([value]) => field.onChange(value)} />
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          value={field.value}
                          onChange={e => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value >= 1 && value <= 32000) {
                              field.onChange(value);
                            }
                          }}
                          min={1}
                          max={32000}
                        />
                      </div>
                    </div>
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="temperature">{t('temperature')}</Label>
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <Slider min={0} max={2} step={0.1} value={[field.value]} onValueChange={([value]) => field.onChange(value)} />
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          value={field.value}
                          onChange={e => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value) && value >= 0 && value <= 2) {
                              field.onChange(value);
                            }
                          }}
                          step={0.1}
                          min={0}
                          max={2}
                        />
                      </div>
                    </div>
                  </div>
                )}
              />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Link
                    href="https://platform.deepseek.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm hover:underline"
                  >
                    {t('getApiKey')}
                  </Link>
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? t('saving') : t('save')}
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  {t('encryptionNote')}{' '}
                  <Link
                    href="https://pycryptodome.readthedocs.io/en/latest/src/cipher/oaep.html"
                    target="_blank"
                    className="text-primary hover:underline"
                    rel="noopener noreferrer"
                  >
                    {t('encryptionTech')}
                  </Link>{' '}
                  {t('encryptionTechNote')}
                </p>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
});
