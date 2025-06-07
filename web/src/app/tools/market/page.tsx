'use client';
import { listAgentTools, listToolSchemas } from '@/actions/tools';
import { Sparkles, Plus } from 'lucide-react';
import { useRef } from 'react';
import { ToolInfoDialog, ToolInfoDialogRef } from './tool-info-dialog';
import { ToolRegisterDialog, ToolRegisterDialogRef } from './tool-register-dialog';
import { useServerAction } from '@/hooks/use-async';
import { Button } from '@/components/ui/button';
import { getMe } from '@/actions/me';

export default function MarketplacePage() {
  const { data: allTools = [], refresh: refreshAllTools } = useServerAction(listToolSchemas, {}, { cache: 'all-tools' });
  const { data: installedTools = [], refresh: refreshInstalledTools } = useServerAction(listAgentTools, {}, { cache: 'installed-tools' });

  const toolInfoDialogRef = useRef<ToolInfoDialogRef>(null);
  const toolRegisterDialogRef = useRef<ToolRegisterDialogRef>(null);

  const { data: me } = useServerAction(getMe, {});

  const handleConfigSuccess = () => {
    refreshAllTools();
    refreshInstalledTools();
  };

  const handleRegisterSuccess = () => {
    refreshAllTools();
    refreshInstalledTools();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mt-24 mb-24 flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <h1 className="relative z-10 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-center text-4xl font-bold tracking-tight text-transparent">
            Tools Market
          </h1>
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform">
            <Sparkles className="h-8 w-8 animate-pulse text-yellow-400" />
          </div>
        </div>
        <p className="text-muted-foreground max-w-2xl text-center">Explore and install powerful tools to enhance your productivity</p>
        {me?.isRoot && (
          <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => toolRegisterDialogRef.current?.showRegister()}>
            <Plus className="h-4 w-4" />
            Register Custom Tool
          </Button>
        )}
      </div>

      {/* Available Tools Section */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {allTools.map(tool => (
          <div
            key={tool.name}
            className="group bg-card hover:border-primary/50 relative flex h-[140px] cursor-pointer flex-col justify-between rounded-lg border p-6 transition-all hover:scale-[1.01] hover:shadow-md"
            onClick={() => toolInfoDialogRef.current?.showInfo(tool)}
          >
            <div className="flex items-center justify-between">
              <span className="group-hover:text-primary line-clamp-1 text-lg font-semibold transition-colors">{tool.name}</span>
              {installedTools.some(installed => installed.id === tool.id) && (
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Installed</span>
              )}
            </div>
            <p className="text-muted-foreground group-hover:text-foreground/80 line-clamp-2 text-sm transition-colors">{tool.description}</p>
          </div>
        ))}
      </div>

      <ToolInfoDialog ref={toolInfoDialogRef} onConfigSuccess={handleConfigSuccess} />
      <ToolRegisterDialog ref={toolRegisterDialogRef} onSuccess={handleRegisterSuccess} />
    </div>
  );
}
