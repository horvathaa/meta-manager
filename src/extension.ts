import { window, ExtensionContext } from 'vscode';
import ViewLoaderProvider from './viewProvider/ViewLoaderProvider';
import { Container } from './container';
// import TimelineController from './view/src/timeline/TimelineController';
import ViewHandler from './view/src';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log(
        'Congratulations, your extension "meta-manager" is now active!'
    );
    window.showInformationMessage('Hello World from meta-manager!');
    // const view = new ViewLoader(context);
    const view = new ViewLoaderProvider(context.extensionUri);
    context.subscriptions.push(
        window.registerWebviewViewProvider(ViewLoaderProvider.viewType, view, {
            webviewOptions: { retainContextWhenHidden: true },
        })
    );

    // const lol = new Container(context);
    const container = await Container.create(context);

    container.initNodes();
    view.onDidCreateView(() => {
        // console.log('view created');
        // lol.createViewController();
        // ViewHandler.create();
        if (view.view) {
            container.setWebviewController(view.view.webview);
            // view.view?.webview.postMessage({ command: 'hewwo' })
        }
    });

    console.log('lol', container);
}

// This method is called when your extension is deactivated
export function deactivate() {}
