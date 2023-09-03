import {
    window,
    ExtensionContext,
    languages,
    workspace,
    Position,
    commands,
} from 'vscode';
import ViewLoaderProvider from './viewProvider/ViewLoaderProvider';
import { Container } from './container';
import ViewLoader from './webviewPane/ViewLoader';
import Test from './test/generateFakeData';

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
        }),
        commands.registerCommand('extension.openView', () => {})
    );

    const container = await Container.create(context);
    container.initNodes();
    view.onDidCreateView(() => {
        if (view.view) {
            container.setWebviewController(view.view.webview);
            container.webviewController?.onDidReceiveMessage((e) => {
                const { command, data } = e;
                // console.log('data!!!!!', data);
                if (command === 'openView') {
                    container.sidePaneWebviewController = new ViewLoader(
                        context.extensionUri,
                        data
                    );
                }
                if (command === 'goToNode') {
                    container.fileParser?.docs.forEach((doc) => {
                        const { nodeId } = data;
                        const node = doc.findNode(nodeId);
                        console.log('node', node);
                        if (node) {
                            // const position = new Position(node.location.start.line, node.start.character);
                            window.showTextDocument(node.location.uri, {
                                selection: node.location.range,
                                preview: true,
                            });
                        }
                    });
                }
            });
        }
    });
    setTimeout(() => {
        console.log('about to run...');
        // container.firestoreController?.renameFile(
        //     'src-utils-sortResults.ts',
        //     'src-utils-extractStackOverflowResults.ts'
        // );
        const test = Test.create(container);
        // const proj = 'hieunc229-copilot-clone';
        // container.firestoreController?.copyOver(
        //     'hieunc229-copilot-clone',
        //     'src-search.ts',
        //     'getSnippetResults:d23b78ef-9d50-4f0d-8a1e-57ea383af9e5',
        //     'src-utils-sortResults.ts',
        //     'extractSnippetResults'
        // );
        // test.run();
        // setInterval(() => test.run(), 5000);
    }, 10000);
}

// This method is called when your extension is deactivated
export function deactivate() {}
