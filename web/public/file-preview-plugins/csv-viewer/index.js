window['csv-viewer'] = {
  async render(context) {
    const { fileContent, container, api } = context;

    try {
      api.showLoading();

      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      // parse csv
      const { data } = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });

      if (data.length === 0) {
        container.innerHTML = '<div class="text-center p-4">empty file</div>';
        return;
      }

      // get headers
      const headers = Object.keys(data[0]);

      // create table html
      const tableHtml = `
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-muted">
            <thead class="bg-muted">
              <tr>
                ${headers
                  .map(
                    header => `
                  <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    ${header}
                  </th>
                `,
                  )
                  .join('')}
              </tr>
            </thead>
            <tbody class="bg-background divide-y divide-muted">
              ${data
                .map(
                  row => `
                <tr class="hover:bg-muted">
                  ${headers
                    .map(
                      header => `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      ${row[header] || ''}
                    </td>
                  `,
                    )
                    .join('')}
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;

      container.innerHTML = tableHtml;

      // add basic style
      const style = document.createElement('style');
      style.textContent = `
        .overflow-x-auto {
          max-height: 80vh;
          overflow: auto;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        th, td {
          border: 1px solid var(--border);
          padding: 0.5rem;
        }
        th {
          background-color: var(--background);
          font-weight: 600;
          text-align: left;
        }
        tr:hover {
          background-color: var(--muted);
        }
      `;
      document.head.appendChild(style);
    } catch (error) {
      console.error('CSV parsing error:', error);
      api.showError('parse csv file failed');
    } finally {
      api.hideLoading();
    }
  },
};
