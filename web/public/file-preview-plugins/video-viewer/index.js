window['video-viewer'] = {
  async render(context) {
    const { container, fileUrl, fileType, api } = context;

    try {
      api.showLoading();

      // Create video player container
      const videoContainer = document.createElement('div');
      videoContainer.className = 'video-viewer';

      // Create video element
      const video = document.createElement('video');
      video.controls = true;
      video.className = 'video-player';

      // Create video source using fileName
      const source = document.createElement('source');
      source.src = fileUrl;
      source.type = `video/${fileType}`;

      // Add error message
      const errorMessage = document.createElement('p');
      errorMessage.className = 'video-error';
      errorMessage.textContent = 'Your browser does not support this video format.';

      // Assemble video player
      video.appendChild(source);
      video.appendChild(errorMessage);
      videoContainer.appendChild(video);

      // Clear container and add new video player
      container.innerHTML = '';
      container.appendChild(videoContainer);

      // Video loading error handling
      video.onerror = error => {
        console.error('Video loading error:', error);
        api.showError('Failed to load video');
      };

      // Video loading complete handling
      video.onloadeddata = () => {
        api.hideLoading();
      };
    } catch (error) {
      console.error('Video rendering error:', error);
      api.showError('Failed to render video');
      api.hideLoading();
    }
  },
};
