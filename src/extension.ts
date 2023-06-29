import { window, ExtensionContext } from 'vscode';
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
            container.setWebviewController(view.view.webview);
        }
    });

    // const originalLog = console.log;
    // console.log = function () {
    //     console.log('custom console log....');
    //     const stack = new Error().stack?.split('\n');
    //     const lineNumber = (stack && stack[2].split(':')[1]) || '';
    //     const values = Array.from(arguments);
    //     console.log('lol what', lineNumber, values);
    //     // Perform actions with the values and lineNumber

    //     Function.prototype.apply.call(originalLog, console, arguments);
    // };
    const terminal = container.debugController?.terminal;
    console.log = function (...args) {
        const message = args.map((arg) => String(arg)).join(' ');
        terminal?.sendText(message + '\n');
    };

    console.error = function (...args) {
        const message = args.map((arg) => String(arg)).join(' ');
        terminal?.sendText(`[ERROR] ${message}\n`);
    };

    console.log('lol', container);
    return () => {
        terminal?.dispose();
    };
}

// This method is called when your extension is deactivated
export function deactivate() {}
