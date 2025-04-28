'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { create } from 'zustand';
import ConfigLlm from './config-llm';
import ConfigPreferences from './config-preferences';

export const useConfigDialog = create<{ open: boolean; show: () => void; hide: () => void }>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

export default function ConfigDialog() {
  const { open, show, hide } = useConfigDialog();

  const [currentTab, setCurrentTab] = useState<'llm' | 'preferences'>('llm');

  return (
    <Dialog open={open} onOpenChange={open => (open ? show() : hide())}>
      <DialogContent className="w-auto pb-1 pl-1" style={{ maxWidth: '100%' }}>
        <div className="flex min-h-[500px] w-[800px] gap-4 pl-4">
          {/* Sidebar */}
          <div className="flex w-[200px] flex-col gap-2">
            <div
              onClick={() => setCurrentTab('llm')}
              className={cn(
                currentTab === 'llm' && 'text-primary',
                'cursor-pointer',
                'rounded-md p-2',
                'hover:bg-muted',
                'transition-colors',
                currentTab === 'llm' && 'bg-muted',
              )}
            >
              Models
            </div>
            <div
              onClick={() => setCurrentTab('preferences')}
              className={cn(
                currentTab === 'preferences' && 'text-primary',
                'cursor-pointer',
                'rounded-md p-2',
                'hover:bg-muted',
                'transition-colors',
                currentTab === 'preferences' && 'bg-muted',
              )}
            >
              Preferences
            </div>
            <div className="mt-auto flex flex-col justify-center gap-2 pb-2">
              <div className="text-muted-foreground/80 flex items-center gap-1.5 text-[10px]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                </svg>
                <span>Version 0.3.5</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span>Powered by</span>
                <a href="https://www.iheytang.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                  iHeyTang
                </a>
              </div>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1">
            {currentTab === 'llm' && <ConfigLlm />}
            {currentTab === 'preferences' && <ConfigPreferences />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
