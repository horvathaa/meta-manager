import {
    window,
    ExtensionContext,
    languages,
    workspace,
    Position,
} from 'vscode';
import ViewLoaderProvider from './viewProvider/ViewLoaderProvider';
import { Container } from './container';
import * as ts from 'typescript';
import { readFileSync } from 'fs';
// import TimelineController from './view/src/timeline/TimelineController';
// import ViewHandler from './view/src';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('hewwo???');
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
    // const terminal = container.debugController?.terminal;
    // console.log = function (...args) {
    //     const message = args.map((arg) => String(arg)).join(' ');
    //     terminal?.sendText(message + '\n');
    // };

    // console.error = function (...args) {
    //     const message = args.map((arg) => String(arg)).join(' ');
    //     terminal?.sendText(`[ERROR] ${message}\n`);
    // };

    window.onDidWriteTerminalData((e) => {
        console.log('TERMINAL DATA E', e);
    });
    console.log('vscode.languages', languages);
    const service = new MyLanguageServiceHost(`
    const message: string = 'Hello, world!';
    console.log(message);
  `);
    const languageService = ts.createLanguageService(
        service,
        ts.createDocumentRegistry()
    );
    console.log('lang', languageService);
    const def = languageService.getDefinitionAtPosition(
        `${service.getCurrentDirectory()}\\source\\utils\\utils.ts`,
        30105
    );
    console.log(
        'def',
        def,
        'languageService',
        languageService,
        'service',
        service
    );

    console.log('lol', container);
    // return () => {
    //     terminal?.dispose();
    // };
}

class MyLanguageServiceHost implements ts.LanguageServiceHost {
    constructor(fileContent: string) {
        // this.fileContent = fileContent;
    }

    getCompilationSettings() {
        // return ts.createCompilerHost();
        const obj: ts.CompilerOptions = {};
        return obj;
    }
    getCurrentDirectory() {
        let folders = workspace.workspaceFolders;
        if (!folders) return '';
        return folders[0].uri.fsPath;
    }
    getDefaultLibFileName() {
        return ts.getDefaultLibFilePath({});
    }
    getScriptFileNames() {
        return [];
    }
    getTypeRootsVersion() {
        return 0;
    }
    getScriptSnapshot(fileName: string) {
        let data = readFileSync(fileName, 'utf-8');
        // if (
        //   fileName.endsWith(".sm") ||
        //   fileName.endsWith(".story") ||
        //   fileName.endsWith(".storymatic")
        // ) {
        //   return ts.ScriptSnapshot.fromString(
        //     transpile(compile(data), { typescript: true })
        //   );
        // }
        return ts.ScriptSnapshot.fromString(data);
    }
    getScriptKind() {
        return ts.ScriptKind.TS;
    }
    getScriptVersion() {
        return '';
    }
    readFile(fileName: string) {
        return readFileSync(fileName, 'utf-8');
    }
    getNewLine() {
        return '\n';
    }
    fileExists(path: string): boolean {
        return false;
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
