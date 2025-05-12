window['markdown-viewer'] = {
  async render(context) {
    const { fileContent, container, api } = context;

    try {
      api.showLoading();

      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      // parse markdown
      const html = marked.parse(fileContent);

      // wrap content in markdown-viewer class
      container.innerHTML = `<div class="markdown-viewer">${html}</div>`;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      api.showError('parse markdown file failed');
    } finally {
      api.hideLoading();
    }
  },
};
