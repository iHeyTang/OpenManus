'use client';

import { createAgent, updateAgent } from '@/actions/agents';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import React, { useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AgentData } from '.';
import { useServerAction } from '@/hooks/use-async';
import { getLlmConfigs } from '@/actions/config';
import { getOrganizationToolsInfo } from '@/actions/tools';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface ConfigDialogProps {
  onSuccess?: (success: boolean) => void;
}

export interface ConfigDialogRef {
  open: (config?: AgentData) => void;
}

export const ConfigDialog = React.forwardRef<ConfigDialogRef, ConfigDialogProps>((props, ref) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: llms, isLoading: llmsLoading } = useServerAction(getLlmConfigs, {});
  const { data: tools, isLoading: toolsLoading } = useServerAction(getOrganizationToolsInfo, {});

  useImperativeHandle(ref, () => ({
    open: (config?: AgentData) => {
      form.reset(config);
      setOpen(true);
    },
  }));

  const form = useForm<AgentData>({
    defaultValues: {
      name: '',
      description: '',
      tools: [],
      llmId: '',
    },
    resolver: async data => {
      const errors: any = {};

      if (!data.name) {
        errors.name = {
          type: 'required',
          message: 'Name is required',
        };
      }

      if (!data.llmId) {
        errors.llmId = {
          type: 'required',
          message: 'LLM is required',
        };
      }

      return {
        values: data,
        errors,
      };
    },
  });

  const onSubmit = async (data: AgentData) => {
    try {
      setLoading(true);
      if (data.id) {
        await updateAgent({ ...data, tools: data.tools });
      } else {
        await createAgent({ ...data, tools: data.tools });
      }
      toast.success('Configuration updated');
      props.onSuccess?.(true);
      setOpen(false);
      form.reset();
    } catch (error) {
      toast.error('Failed to update configuration');
      props.onSuccess?.(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent style={{ maxWidth: '800px' }}>
          <DialogHeader className="mb-2">
            <DialogTitle>LLM Configuration</DialogTitle>
            <DialogDescription>Configure your LLM API settings</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-1">
                      Name
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input id="name" {...field} placeholder="e.g. deepseek-chat" />
                    {form.formState.errors.name && <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>}
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="description" className="flex items-center gap-1">
                      Description
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input id="description" {...field} placeholder="Enter your description" />
                    {form.formState.errors.description && <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>}
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="llmId"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="llmId" className="flex items-center gap-1">
                      LLM
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select LLM">
                          {llms?.find(llm => llm.id === field.value)?.name || llms?.find(llm => llm.id === field.value)?.model || 'Select LLM'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {llms?.map(llm => (
                          <SelectItem key={llm.id} value={llm.id}>
                            {llm.name || llm.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.llmId && <p className="text-sm text-red-500">{form.formState.errors.llmId.message}</p>}
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="tools"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label htmlFor="tools">Tools</Label>
                    <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                      {tools?.map(tool => (
                        <div key={tool.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`tool-${tool.id}`}
                            checked={field.value?.includes(tool.id)}
                            onCheckedChange={checked => {
                              const currentTools = field.value || [];
                              if (checked) {
                                field.onChange([...currentTools, tool.id]);
                              } else {
                                field.onChange(currentTools.filter((id: string) => id !== tool.id));
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <Label
                            htmlFor={`tool-${tool.id}`}
                            className="flex cursor-pointer items-center gap-2 text-sm leading-none font-normal select-none"
                          >
                            {tool.name}
                            {tool.type === 'mcp' && (
                              <Badge variant="outline" className="text-xs">
                                MCP
                              </Badge>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              />
              <div className="flex items-center justify-between">
                <div></div>
                <div className="flex space-x-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
});
