import {
    CancellationToken,
    EventEmitter,
    Uri,
    ViewColumn,
    WebviewPanel,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
    window,
} from 'vscode';
import { getNonce } from '../utils/lib';
import { AdditionalMetadata, CopyBuffer } from '../constants/types';
import { WEB_INFO_SOURCE } from '../view/src/types/types';
// import { VS_CODE_API } from '../view2/src/VSCodeApi';
// import TimelinesChart from 'timelines-chart';

interface InitData {
    type: WEB_INFO_SOURCE;
    node: any;
    copyBuffer: CopyBuffer;
}

class ViewLoader {
    // public static readonly viewType = 'meta-manager-view'; // THIS IS THE NAME OF THE VIEW CONTAINER -- THERE IS A DIFFERENCE, STUPIDLY ENOUGH
    // BELOW, WE HAVE THE VIEW ___TYPE___ OF THE SPECIFIC WEBVIEW THAT OUR CONTAINER WILL RENDER
    // GOD WHY DID THEY MAKE THIS SO FUCKING CONFUSING -- TOO MANY VIEWS!!!!!!!!!!!!!!!!!!!!!
    public static readonly viewType = 'meta-manager.webview';
    private _view?: WebviewPanel;
    private _localUri?: Uri;
    private _onDidCreateView: EventEmitter<void> = new EventEmitter<void>();

    constructor(
        private readonly _extensionUri: Uri,
        private initData?: InitData | null
    ) {
        this._localUri = Uri.joinPath(
            this._extensionUri,
            'dist'
            // 'view',
            // 'webview-index.js'
        );
        this._view = window.createWebviewPanel(
            ViewLoader.viewType,
            'Meta Manager',
            ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._localUri],
            }
        );
        this._view.webview.html = this.getWebviewContent();
    }

    get view() {
        return this._view;
    }

    private getWebviewContent(): string {
        // console.log('hwwwlllooo');
        if (!this._view || !this._localUri) {
            console.error('No webview!');
            return '';
        }
        // Local path to main script run in the webview

        const reactAppPathOnDisk = this._view.webview.asWebviewUri(
            Uri.joinPath(
                this._extensionUri,
                'dist',
                // 'view',
                'webview-index.js'
            )
        );

        const nonce = getNonce();
        console.log('excuse me', this.initData);

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
                window.initData = ${JSON.stringify(this.initData)};
            </script>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}" src="${reactAppPathOnDisk}"></script>
        </body>
        </html>`;

        return webviewContent;
    }

    // public sendHi() {
    //     VS_CODE_API.postMessage({
    //         command: 'hi',
    //     });
    // }
}

export default ViewLoader;
