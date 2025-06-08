import { create } from 'zustand';
import { useServerAction } from './use-async';
import { listAgentTools } from '@/actions/tools';
import { useCallback, useEffect } from 'react';

type AgentTool = NonNullable<Awaited<ReturnType<typeof listAgentTools>>['data']>[number];

interface AgentToolsState {
  allTools: AgentTool[];
  isLoading: boolean;
  isInitialized: boolean;
  setAllTools: (tools: AgentTool[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (value: boolean) => void;
  refreshTools: () => Promise<void>;
}

const useAgentToolsStore = create<AgentToolsState>((set, get) => ({
  allTools: [],
  isLoading: false,
  isInitialized: false,
  setAllTools: tools => set({ allTools: tools }),
  setLoading: loading => set({ isLoading: loading }),
  setInitialized: value => set({ isInitialized: value }),
  refreshTools: async () => {
    const { setLoading, setAllTools, setInitialized } = get();
    try {
      setLoading(true);
      const response = await listAgentTools({});
      if (response.data) {
        setAllTools(response.data);
        setInitialized(true);
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    } finally {
      setLoading(false);
    }
  },
}));

const useAgentTools = () => {
  const { allTools, isLoading, isInitialized, refreshTools } = useAgentToolsStore();

  useEffect(() => {
    if (!isInitialized) {
      refreshTools();
    }
  }, [isInitialized, refreshTools]);

  const getToolByPrefix = useCallback(
    (key: string) => {
      const k = allTools.find(tool => key.startsWith(tool.id));
      if (!k)
        return {
          toolName: key,
          functionName: '',
        };
      return {
        toolName: k.name,
        functionName: key.replace(`${k.id}-` || '', ''),
      };
    },
    [allTools],
  );

  return {
    allTools,
    isLoading,
    refreshTools,
    getToolByPrefix,
  };
};

export default useAgentTools;
