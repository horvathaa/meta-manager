// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ViewLoader from './viewProvider/ViewLoader';
import { TextDocument, window, commands, ExtensionContext } from 'vscode';
import { MetaInformationExtractor } from './comments/CommentCreator';
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
    console.log(
        'view',
        view
        // '??',
        // vscode.window.registerWebviewViewProvider(
        //     ViewLoaderProvider.viewType,
        //     view,
        //     { webviewOptions: { retainContextWhenHidden: true } }
        // )
    );
    // if (view) {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ViewLoaderProvider.viewType,
            view,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
    // }
    if (window.activeTextEditor) {
        // const meta = new MetaInformationExtractor(
        //     window.activeTextEditor.document as TextDocument
        // );
    }

    // const lol = new Container(context);
    const lol = await Container.create(context);
    console.log('lol', lol);

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = commands.registerCommand('meta-manager.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
