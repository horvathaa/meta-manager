import * as vscode from 'vscode';
import * as path from 'path';
import { getNonce } from '../lib';

export default class ViewLoader {
    public _panel: vscode.WebviewPanel | undefined;
    private readonly _context: vscode.ExtensionContext;
    private readonly _localUri: vscode.Uri;

    // create the webview and point it to our compiled/bundled extension
    // this is the entry point for our React code
    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._localUri = vscode.Uri.joinPath(
            this._context.extensionUri,
            'dist',
            // 'view',
            'index.js'
        );

        this._panel = vscode.window.createWebviewPanel(
            'meta-manager',
            'Meta Manager',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                // localResourceRoots: [this._localUri],
                // this should NOT need to be commented out
                // something wonky is happening here
            }
        );

        this._panel.webview.html = this.getWebviewContent();
    }

    // generate our "HTML" which will be used to load our React code
    private getWebviewContent(): string {
        if (!this._panel) {
            console.error('No webview!');
            return '';
        }
        // Local path to main script run in the webview

        const reactAppPathOnDisk = this._panel.webview.asWebviewUri(
            this._localUri
        );

        const nonce = getNonce();
        // unsafe eval?
        let webviewContent = `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
	
                <meta http-equiv="Content-Security-Policy"
                      content="default-src 'none';
                              
                              script-src 'nonce-${nonce}' 'unsafe-eval';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

          <script nonce="${nonce}">
            window.acquireVsCodeApi = acquireVsCodeApi;
          </script>
      </head>
      <body>
          <div id="root">Hewwo</div>
          <script nonce="${nonce}" src="${reactAppPathOnDisk}"></script>
      </body>
    </html>`;

        return webviewContent;
    }
}
