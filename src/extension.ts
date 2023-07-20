import {
    window,
    ExtensionContext,
    languages,
    workspace,
    Position,
} from 'vscode';
import ViewLoaderProvider from './viewProvider/ViewLoaderProvider';
import { Container } from './container';

// import TimelineController from './view/src/timeline/TimelineController';
// import ViewHandler from './view/src';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated

    const view = new ViewLoaderProvider(context.extensionUri);
    context.subscriptions.push(
        window.registerWebviewViewProvider(ViewLoaderProvider.viewType, view, {
            webviewOptions: { retainContextWhenHidden: true },
        })
    );

    const container = await Container.create(context);
    container.initNodes();
    view.onDidCreateView(() => {
        if (view.view) {
            // console.log('view???', view);
            container.setWebviewController(view.view.webview);
        }
        // setTimeout(() => {
        //     container.webviewController?.postMessage({ command: 'hi' });
        // }, 10000);
    });

    // window.onDidWriteTerminalData((e) => {
    //     console.log('TERMINAL DATA E', e);
    // });

    console.log('lol', container);
    // return () => {
    //     terminal?.dispose();
    // };
}

// This method is called when your extension is deactivated
export function deactivate() {}

// function getRangeFromLineNumbers(
//     startLine: number,
//     endLine: number,
//     document: any
// ) {
//     const startPosition = new Position(startLine, 0);
//     const endPosition = new Position(endLine, 0);
//     const range = document.validateRange(
//         new Range(startPosition, endPosition)
//     );
//     return range;
// }
