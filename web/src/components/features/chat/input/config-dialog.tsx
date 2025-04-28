import { getLlmConfigs } from '@/actions/config';
import { getOrganizationToolsInfo } from '@/actions/tools';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useServerAction } from '@/hooks/use-async';
import { Info, X } from 'lucide-react';
import React, { useImperativeHandle, useState } from 'react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const DEFAULT_SELECTED_TOOLS = ['web_search', 'str_replace_editor', 'python_execute', 'browser_use'];

export const useInputConfig = create<{
  selectedModel: string;
  setSelectedModel: (selected: string) => void;
  selectedTools: string[];
  setSelectedTools: (selected: string[]) => void;
}>()(
  persist(
    set => ({
      selectedModel: 'default',
      setSelectedModel: selected => set({ selectedModel: selected }),
      selectedTools: [],
      setSelectedTools: selected => set({ selectedTools: selected }),
    }),
    {
      name: 'input-config-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        selectedModel: state.selectedModel,
        selectedTools: state.selectedTools.length > 0 ? state.selectedTools : DEFAULT_SELECTED_TOOLS,
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
  const [showTool, setShowTool] = useState<string | null>(null);

  const { data: llmConfigs } = useServerAction(getLlmConfigs, {});
  const { data: allTools } = useServerAction(getOrganizationToolsInfo, {});

  const { selectedModel, setSelectedModel, selectedTools, setSelectedTools } = useInputConfig();

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      setSelectedModel(selectedModel);
      setSelectedTools(selectedTools);
    },
  }));

  const handleToggleTool = (toolId: string) => {
    setSelectedTools(selectedTools?.includes(toolId) ? selectedTools.filter(id => id !== toolId) : [...(selectedTools ?? []), toolId]);
  };

  const handleShowToolInfo = (toolId: string) => {
    setShowTool(toolId);
  };

  const handleSelectModel = (value: string) => {
    setSelectedModel(value);
  };

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
              <Select value={selectedModel} onValueChange={value => handleSelectModel(value)}>
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
                {selectedTools?.map(toolId => {
                  const tool = allTools?.find(t => t.id === toolId);
                  return (
                    <Badge key={toolId} variant="secondary" className="flex items-center gap-1">
                      {tool?.name}
                      <X className="hover:text-destructive h-3 w-3 cursor-pointer" onClick={() => handleToggleTool(toolId)} />
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
                    selectedTools?.includes(tool.id) ? 'border-primary bg-muted' : ''
                  }`}
                  onClick={() => handleShowToolInfo(tool.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="line-clamp-1 text-sm font-medium">{tool.name}</span>
                    <div className="flex items-center gap-2">
                      {tool.type === 'mcp' && <Badge variant="secondary">MCP</Badge>}
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
                        checked={selectedTools?.includes(tool.id)}
                        onCheckedChange={() => handleToggleTool(tool.id)}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{tool.description}</p>
                </div>
              ))}
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
      <Dialog open={!!showTool} onOpenChange={open => !open && setShowTool(null)}>
        <DialogContent style={{ height: '500px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DialogHeader className="h-12">
            <DialogTitle>{showTool}</DialogTitle>
          </DialogHeader>
          {showTool && (
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
                    {allTools?.find(t => t.id === showTool)?.description}
                  </Markdown>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});
