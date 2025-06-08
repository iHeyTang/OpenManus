export interface FilePreviewPluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  fileTypes: string[]; // supported file types
  entryPoint: string; // entry point
  styles?: string[]; // styles
  permissions?: string[]; // permissions
}

export interface FilePreviewPluginContext {
  fileContent: string;
  fileType: string;
  fileName: string;
  fileUrl: string;
  container: HTMLElement;
  api: FilePreviewPluginAPI;
}

export interface FilePreviewPluginAPI {
  // API for plugins
  getFileContent(): Promise<string>;
  updateContent(content: string): void;
  showError(message: string): void;
  showLoading(): void;
  hideLoading(): void;
}

export const PLUGIN_PATH = '/file-preview-plugins';

export class FilePreviewPluginManager {
  private plugins: Map<string, FilePreviewPluginManifest> = new Map();

  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const manifest = await this.loadManifest(pluginPath);
      this.plugins.set(manifest.name, manifest);

      // load plugin resources
      await this.loadPluginResources(manifest);
    } catch (error) {
      console.error(`Failed to load plugin: ${pluginPath}`, error);
      throw error;
    }
  }

  async loadAllPlugins(pluginPaths: string[]): Promise<void> {
    for (const pluginPath of pluginPaths) {
      await this.loadPlugin(pluginPath);
    }
  }

  private async loadManifest(pluginPath: string): Promise<FilePreviewPluginManifest> {
    const response = await fetch(`${PLUGIN_PATH}/${pluginPath}/manifest.json`);
    if (!response.ok) {
      throw new Error('Failed to load plugin manifest');
    }
    return response.json();
  }

  private async loadPluginResources(manifest: FilePreviewPluginManifest): Promise<void> {
    // load styles
    if (manifest.styles) {
      for (const style of manifest.styles) {
        await this.loadStyle(`${PLUGIN_PATH}/${manifest.name}/${style}`);
      }
    }

    // load script
    await this.loadScript(`${PLUGIN_PATH}/${manifest.name}/${manifest.entryPoint}`);
  }

  private loadStyle(href: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  getPluginForFileType(fileType: string): FilePreviewPluginManifest | undefined {
    return Array.from(this.plugins.values()).find(plugin => plugin.fileTypes.includes(fileType));
  }
}
