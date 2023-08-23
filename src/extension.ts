import {
    window,
    ExtensionContext,
    languages,
    workspace,
    Position,
} from 'vscode';
import ViewLoaderProvider from './viewProvider/ViewLoaderProvider';
import { Container } from './container';
import ViewLoader from './webviewPane/ViewLoader';

// import TimelineController from './view/src/timeline/TimelineController';
// import ViewHandler from './view/src';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated

    const view = new ViewLoaderProvider(context.extensionUri);
    // const otherView = new ViewLoader(context.extensionUri);
    context.subscriptions.push(
        window.registerWebviewViewProvider(ViewLoaderProvider.viewType, view, {
            webviewOptions: { retainContextWhenHidden: true },
        })
    );

    const container = await Container.create(context);
    container.initNodes();
    view.onDidCreateView(() => {
        if (view.view) {
            container.setWebviewController(view.view.webview);
            container.webviewController?.onDidReceiveMessage((e) => {
                const { command, data } = e;
                console.log('data!!!!!', data);
                if (command === 'openView') {
                    container.sidePaneWebviewController = new ViewLoader(
                        context.extensionUri,
                        data
                    );
                }
            });
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}
