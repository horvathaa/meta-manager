import {
    CancellationToken,
    EventEmitter,
    Uri,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from 'vscode';
import { getNonce } from '../utils/lib';
// import { VS_CODE_API } from '../view2/src/VSCodeApi';
// import TimelinesChart from 'timelines-chart';

class ViewLoaderProvider implements WebviewViewProvider {
    // public static readonly viewType = 'meta-manager-view'; // THIS IS THE NAME OF THE VIEW CONTAINER -- THERE IS A DIFFERENCE, STUPIDLY ENOUGH
    // BELOW, WE HAVE THE VIEW ___TYPE___ OF THE SPECIFIC WEBVIEW THAT OUR CONTAINER WILL RENDER
    // GOD WHY DID THEY MAKE THIS SO FUCKING CONFUSING -- TOO MANY VIEWS!!!!!!!!!!!!!!!!!!!!!
    public static readonly viewType = 'meta-manager.webview';
    private _view?: WebviewView;
    private _localUri?: Uri;
    private _onDidCreateView: EventEmitter<void> = new EventEmitter<void>();

    constructor(private readonly _extensionUri: Uri) {
        this._localUri = Uri.joinPath(
            this._extensionUri,
            'dist',
            // 'view',
            'index.js'
        );
    }

    get onDidCreateView() {
        return this._onDidCreateView.event;
    }

    get view() {
        return this._view;
    }

    public resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext,
        _token: CancellationToken
    ) {
        // console.log('WHUIHADI');
        // console.log('is this being called', webviewView, context, _token);
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            // localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this.getWebviewContent();
        this._onDidCreateView.fire();
    }

    private getWebviewContent(): string {
        // console.log('hwwwlllooo');
        if (!this._view || !this._localUri) {
            console.error('No webview!');
            return '';
        }
        // Local path to main script run in the webview

        const reactAppPathOnDisk = this._view.webview.asWebviewUri(
            this._localUri
        );

        const nonce = getNonce();

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
                                style-src  'unsafe-inline';
                                script-src 'nonce-${nonce}' 'unsafe-eval';">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <script nonce="${nonce}">
                window.acquireVsCodeApi = acquireVsCodeApi;
            </script>
        </head>
        <body>
            <div style="display: flex">
                <svg width="500" height="400"></svg>
                <div id="root"></div>
            </div>
            <script nonce="${nonce}" src="${reactAppPathOnDisk}"></script>
        </body>
        </html>`;

        return webviewContent;
    }
}

export default ViewLoaderProvider;
