import { window, ExtensionContext } from 'vscode';
import ViewLoaderProvider from './viewProvider/ViewLoaderProvider';
import { Container } from './container';

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
    const lol = await Container.create(context);
    lol.initNodes();
    console.log('lol', lol);
}

// This method is called when your extension is deactivated
export function deactivate() {}
