import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'frameCopy.videoPlayer',
      new VideoEditorProvider(),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

class VideoEditorProvider implements vscode.CustomReadonlyEditorProvider {
  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.dirname(document.uri.fsPath))]
    };

    const videoSrc = webviewPanel.webview.asWebviewUri(document.uri);
    const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    webviewPanel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${webviewPanel.webview.cspSource}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Video Player</title>
  <style>
    body { margin: 0; padding: 20px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }
    #video { width: 100%; display: block; margin-bottom: 10px; background-color: #000; }
    .controls { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    button { padding: 8px 16px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px; font-family: var(--vscode-font-family); font-size: 13px; }
    button:hover { background-color: var(--vscode-button-hoverBackground); }
    button:active { opacity: 0.8; }
    #timestamp { font-family: var(--vscode-editor-font-family); font-size: 13px; color: var(--vscode-descriptionForeground); }
    .flash { animation: flash 0.2s ease-in-out; }
    @keyframes flash { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  </style>
</head>
<body>
  <video id="video" src="${videoSrc}" controls></video>
  <div class="controls">
    <button id="copy">Copy Frame</button>
    <span id="timestamp">image at 0s</span>
  </div>
  <script nonce="${nonce}">
    const video = document.getElementById('video');
    const timestamp = document.getElementById('timestamp');

    video.addEventListener('timeupdate', () => {
      const s = Math.floor(video.currentTime);
      timestamp.textContent = \`image at \${s}s\`;
    });

    document.getElementById('copy').addEventListener('click', async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

        const s = Math.floor(video.currentTime);
        const text = \`[image taken at \${s}s]\`;
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
            'text/html': new Blob([\`<img src="\${base64}"/><p>\${text}</p>\`], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' })
          })
        ]);

        video.classList.add('flash');
        setTimeout(() => video.classList.remove('flash'), 200);
      } catch (error) {
        alert('Failed to copy frame: ' + error.message);
      }
    });
  </script>
</body>
</html>`;
  }
}

export function deactivate() {}
