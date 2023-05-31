import {
    CancellationToken,
    Uri,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
} from 'vscode';
import { getNonce } from '../lib';
import TimelinesChart from 'timelines-chart';

class ViewLoaderProvider implements WebviewViewProvider {
    // public static readonly viewType = 'meta-manager-view'; // THIS IS THE NAME OF THE VIEW CONTAINER -- THERE IS A DIFFERENCE, STUPIDLY ENOUGH
    // BELOW, WE HAVE THE VIEW ___TYPE___ OF THE SPECIFIC WEBVIEW THAT OUR CONTAINER WILL RENDER
    // GOD WHY DID THEY MAKE THIS SO FUCKING CONFUSING -- TOO MANY VIEWS!!!!!!!!!!!!!!!!!!!!!
    public static readonly viewType = 'meta-manager.webview';
    private _view?: WebviewView;
    private _localUri?: Uri;

    constructor(private readonly _extensionUri: Uri) {
        this._localUri = Uri.joinPath(
            this._extensionUri,
            'dist',
            // 'view',
            'index.js'
        );
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
        const testStr = `
        import TimelinesChart from 'timelines-chart';
        const el = document.getElementById('root');
        const chart = TimelinesChart(); 
        chart.data([
            {
                group: 'group1name',
                data: [
                    {
                        label: 'label1name',
                        data: [
                            {
                                timeRange: [1685541200925, 1685541234757],
                                val: 'str1',
                            },
                            {
                                timeRange: [1685541199925, 1685541200925],
                                val: 'str2',
                            },
                        ],
                    },
                ],
            },
        ])(el);
        `;
        // const chart = TimelinesChart();
        // chart.data([
        //     {
        //         group: 'group1name',
        //         data: [
        //             {
        //                 label: 'label1name',
        //                 data: [
        //                     {
        //                         timeRange: [1685541200925, 1685541234757],
        //                         val: 'str1',
        //                     },
        //                     {
        //                         timeRange: [1685541199925, 1685541200925],
        //                         val: 'str2',
        //                     },
        //                 ],
        //             },
        //         ],
        //     },
        // ])(`<div id="root"></div>`);

        // <div id="root"></div>
        //     <script nonce="${nonce}" src="${reactAppPathOnDisk}"></script>
        // <script nonce="${nonce}">${testStr}</script>

        // const testStr = ''
        // unsafe eval?
        // <script nonce="${nonce}">${testStr}</script>
        // 'nonce-${nonce}'
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
            <div id="root"></div>
            <script nonce="${nonce}" src="${reactAppPathOnDisk}"></script>
        </body>
        </html>`;

        return webviewContent;
    }
}

export default ViewLoaderProvider;
