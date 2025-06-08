import React, { useEffect, useRef } from 'react';
import {
  FilePreviewPluginManager,
  FilePreviewPluginContext,
  FilePreviewPluginAPI,
} from '@/components/features/chat/preview/preview-content/file-preview-plugin-manager';

interface FilePreviewContainerProps {
  fileContent: string;
  fileType: string;
  fileName: string;
  fileUrl: string;
  pluginManager: FilePreviewPluginManager;
}

export const FilePreviewContainer: React.FC<FilePreviewContainerProps> = ({ fileContent, fileType, fileName, fileUrl, pluginManager }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPlugin = async () => {
      if (!containerRef.current) return;

      const plugin = pluginManager.getPluginForFileType(fileType);
      if (!plugin) {
        containerRef.current.innerHTML = 'No plugin available for this file type';
        return;
      }

      const context: FilePreviewPluginContext = {
        fileContent,
        fileType,
        fileName,
        fileUrl,
        container: containerRef.current,
        api: createPluginAPI(containerRef.current),
      };

      try {
        // call plugin render function
        const pluginName = plugin.name;
        const pluginInstance = (window as any)[pluginName];
        if (typeof pluginInstance.render === 'function') {
          await pluginInstance.render(context);
        }
      } catch (error) {
        console.error('Plugin rendering failed:', error);
        containerRef.current.innerHTML = 'Failed to render file content';
      }
    };

    loadPlugin();
  }, [fileContent, fileType, fileName, pluginManager]);

  return <div ref={containerRef} className="plugin-container" />;
};

function createPluginAPI(container: HTMLElement): FilePreviewPluginAPI {
  return {
    getFileContent: async () => {
      // implement get file content logic
      return '';
    },
    updateContent: (content: string) => {
      container.innerHTML = content;
    },
    showError: (message: string) => {
      container.innerHTML = `<div class="error">${message}</div>`;
    },
    showLoading: () => {
      container.innerHTML = '<div class="loading">Loading...</div>';
    },
    hideLoading: () => {
      const loading = container.querySelector('.loading');
      if (loading) {
        loading.remove();
      }
    },
  };
}
