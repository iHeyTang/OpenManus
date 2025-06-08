import { getLlmConfigs } from '@/actions/config';
import { removeTool } from '@/actions/tools';
import { confirm } from '@/components/block/confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useServerAction } from '@/hooks/use-async';
import { Info, Plus, X } from 'lucide-react';
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AddNewCustomToolDialog, AddNewCustomToolDialogRef } from './add-new-custom-tool-dialog';
import useAgentTools from '@/hooks/use-tools';

const DEFAULT_SELECTED_TOOLS = ['web_search', 'str_replace_editor', 'python_execute', 'browser_use'];

export const useInputConfig = create<{
  enabledModel: string;
  setEnabledModel: (selected: string) => void;
  enabledTools: string[];
  setEnabledTools: (selected: string[]) => void;
}>()(
  persist(
    set => ({
      enabledModel: 'default',
      setEnabledModel: selected => set({ enabledModel: selected }),
      enabledTools: [],
      setEnabledTools: selected => set({ enabledTools: selected }),
    }),
    {
      name: 'input-config-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        enabledModel: state.enabledModel,
        enabledTools: state.enabledTools.length > 0 ? state.enabledTools : DEFAULT_SELECTED_TOOLS,
      }),
    },
  ),
);

interface InputConfigDialogProps {}

export interface InputConfigDialogRef {
  open: () => void;
}

export const InputConfigDialog = React.forwardRef<InputConfigDialogRef, InputConfigDialogProps>((props, ref) => {
  const [open, setOpen] = useState(false);
  const [showToolId, setShowToolId] = useState<string | null>(null);
  const addNewCustomToolRef = useRef<AddNewCustomToolDialogRef>(null);

  const { data: llmConfigs } = useServerAction(getLlmConfigs, {});
  const { allTools, refreshTools } = useAgentTools();

  const { enabledModel, setEnabledModel, enabledTools, setEnabledTools } = useInputConfig();

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setEnabledModel(enabledModel);
      setEnabledTools(enabledTools);
    },
  }));

  useEffect(() => {
    // if allTools is loaded, update the enabledTools, it's for the case enabled tools is not in the tools
    if (allTools?.length) {
      useInputConfig.setState(state => {
        const selectedTools = state.enabledTools.filter(t => allTools.some(tool => tool.id === t));
        return { ...state, enabledTools: selectedTools };
      });
    }
  }, [allTools]);

  useEffect(() => {
    // if llmConfigs is loaded, update the enabledModel, it's for the case enabled model is not in the llmConfigs or enabledModel is not set yet
    if (llmConfigs?.length) {
      const llm = llmConfigs.find(c => c.id === enabledModel);
      if (llm) {
        setEnabledModel(llm.id);
      } else {
        setEnabledModel(llmConfigs[0].id);
      }
    }
  }, [llmConfigs, enabledModel]);

  const handleToggleTool = (toolId: string) => {
    setEnabledTools(enabledTools?.includes(toolId) ? enabledTools.filter(id => id !== toolId) : [...(enabledTools ?? []), toolId]);
  };

  const handleShowToolInfo = (toolId: string) => {
    setShowToolId(toolId);
  };

  const handleSelectModel = (value: string) => {
    setEnabledModel(value);
  };

  const handleRemoveCustomTool = (toolId: string) => {
    confirm({
      content: (
        <div>
          <p>Are you sure you want to remove this custom tool?</p>
        </div>
      ),
      onConfirm: async () => {
        await removeTool({ toolId });
        setShowToolId(null);
        refreshTools();
      },
      buttonText: {
        confirm: 'Confirm Remove',
        cancel: 'Cancel',
      },
    });
  };

  const showToolInfo = useMemo(() => {
    return allTools?.find(t => t.id === showToolId);
  }, [showToolId, allTools]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ width: '90vw', maxWidth: '90vw', display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '80vh' }}>
          <DialogHeader>
            <DialogTitle>Tools Configuration</DialogTitle>
          </DialogHeader>

          <div className="flex h-full flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Model</Label>
              <Select value={enabledModel} onValueChange={value => handleSelectModel(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {llmConfigs?.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name || config.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Selected Tools Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Selected Tools</h3>
              <div className="flex flex-wrap gap-2">
                {enabledTools?.map(toolId => {
                  const tool = allTools?.find(t => t.id === toolId);
                  return (
                    <Badge key={toolId} variant="secondary" className="flex items-center gap-1">
                      {tool?.name || 'unknown'}
                      <div className="hover:text-destructive cursor-pointer" onClick={() => handleToggleTool(toolId)}>
                        <X className="h-3 w-3" />
                      </div>
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Available Tools Section */}
            <div className="grid flex-1 grid-cols-4 content-start items-start gap-4 overflow-y-auto">
              {allTools?.map(tool => (
                <div
                  key={tool.id}
                  className={`group hover:bg-muted relative flex h-[80px] cursor-pointer flex-col justify-between rounded-md border p-2 transition-colors ${
                    enabledTools?.includes(tool.id) ? 'border-primary bg-muted' : ''
                  }`}
                  onClick={() => handleShowToolInfo(tool.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="line-clamp-1 text-sm font-medium">{tool.name}</span>
                    <div className="flex items-center gap-2">
                      {tool.type === 'mcp' && <Badge variant="secondary">MCP</Badge>}
                      {tool.source === 'CUSTOM' && <Badge variant="secondary">CUSTOM</Badge>}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info
                              className="text-muted-foreground hover:text-foreground h-4 w-4 cursor-pointer"
                              onClick={() => handleShowToolInfo(tool.id)}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Click to view details</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Checkbox
                        onClick={e => {
                          e.stopPropagation();
                        }}
                        checked={enabledTools?.includes(tool.id)}
                        onCheckedChange={() => handleToggleTool(tool.id)}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{tool.description}</p>
                </div>
              ))}
              {/* action for add a new custom tools */}
              <div className="flex h-[80px] items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Add a new custom tool</h3>
                </div>
                <Button variant="outline" onClick={() => addNewCustomToolRef.current?.open()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tool Market Entry */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Tool Market</h3>
                <p className="text-muted-foreground text-sm">Discover and install new tools from our marketplace</p>
              </div>
              <Button variant="outline" onClick={() => window.open('/tools/market', '_blank')}>
                Browse Market
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tool Info Dialog */}
      <Dialog open={!!showToolId} onOpenChange={open => !open && setShowToolId(null)}>
        <DialogContent style={{ height: '500px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader className="h-12">
            <DialogTitle>{showToolInfo?.name || 'Unknown'}</DialogTitle>
            <div className="flex items-center gap-2">
              {showToolInfo?.type === 'mcp' && <Badge variant="secondary">MCP</Badge>}
              {showToolInfo?.source === 'CUSTOM' && <Badge variant="secondary">CUSTOM</Badge>}
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto">
            <div>
              <div className="markdown-body text-wrap">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    a: ({ href, children }) => {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {showToolInfo?.description}
                </Markdown>
              </div>
            </div>
          </div>
          <DialogFooter>
            {showToolInfo?.source === 'CUSTOM' && (
              <Button variant="outline" onClick={() => handleRemoveCustomTool(showToolInfo.id)}>
                Remove
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddNewCustomToolDialog
        ref={addNewCustomToolRef}
        onSuccess={() => {
          refreshTools();
        }}
      />
    </>
  );
});
