import { registerTool } from '@/actions/tools';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

interface ToolRegisterDialogProps {
  onSuccess?: () => void;
}

export interface ToolRegisterDialogRef {
  showRegister: () => void;
}

const toolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  repoUrl: z.string().min(1, 'Repo URL is required'),
  configuration: z.string().min(1, 'Configuration is required'),
});

export const ToolRegisterDialog = forwardRef<ToolRegisterDialogRef, ToolRegisterDialogProps>(({ onSuccess }, ref) => {
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof toolSchema>>({
    resolver: zodResolver(toolSchema),
    defaultValues: {
      name: '',
      description: '',
      repoUrl: '',
    },
  });

  useImperativeHandle(ref, () => ({
    showRegister: () => {
      setOpen(true);
    },
  }));

  const onSubmit = async (values: z.infer<typeof toolSchema>) => {
    try {
      const configuration = JSON.parse(values.configuration);
      await registerTool({
        name: values.name,
        description: values.description,
        repoUrl: values.repoUrl,
        command: configuration.command,
        args: configuration.args,
        envSchema: configuration.envSchema,
      });

      toast.success('Success', {
        description: 'Tool registered successfully',
      });
      onSuccess?.();
    } catch (error) {
      toast.error('Failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Register New Tool</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter tool name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="repoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repo Github URL</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter tool repo github url" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter tool description" className="min-h-[200px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="configuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Configuration</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter tool configuration" className="min-h-[200px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Register
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
});
