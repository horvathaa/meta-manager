import {
    Disposable,
    EventEmitter,
    ExtensionContext,
    Webview,
    WorkspaceFolder,
    workspace,
    env,
    TextEditor,
    WorkspaceEdit,
    commands,
    TextEditorEdit,
} from 'vscode';
import { DataController } from './data/DataController';
import FileParser from './document/fileParser';
import FileSystemController from './fs/FileSystemController';
import GitController from './data/git/GitController';
import FirestoreController from './data/firestore/FirestoreController';
// import TimelineController from './view/src/timeline/TimelineController';
import DebugController from './debug/debug';
import LanguageServiceProvider from './document/languageServiceProvider/LanguageServiceProvider';
import { CopyBuffer } from './constants/types';

export class Container {
    // https://stackoverflow.com/questions/59641564/what-are-the-differences-between-the-private-keyword-and-private-fields-in-types -- why # sign
    static #instance: Container;
    _disposables: Disposable[];
    _onInitComplete: EventEmitter<Container> = new EventEmitter<Container>();
    _onNodesComplete: EventEmitter<Container> = new EventEmitter<Container>();

    private readonly _context: ExtensionContext;
    constructor(context: ExtensionContext) {
        this._disposables = [];
        this._workspaceFolder = workspace.workspaceFolders
            ? workspace.workspaceFolders[0]
            : undefined;
        this._fileSystemController =
            this._workspaceFolder &&
            FileSystemController.create(this._workspaceFolder.uri);
        this._languageServiceProvider = LanguageServiceProvider.create(this);
        this._clipboardCopyDisposable = commands.registerTextEditorCommand(
            'editor.action.clipboardCopyAction',
            (textEditor: TextEditor, edit: TextEditorEdit, params: any) =>
                this.overriddenClipboardCopyAction(textEditor, edit, params)
        );
        this._disposables.push(
            // (this._dataController = new DataController(this))
            // (this._fileParser = FileParser.createFileParser(context, this)) // new FileParser(context, this))
            this._clipboardCopyDisposable
        );
        this._context = context;
    }

    private _fileParser: FileParser | undefined;
    public get fileParser(): FileParser | undefined {
        return this._fileParser;
    }

    public get context(): ExtensionContext {
        return this._context;
    }

    private _workspaceFolder: WorkspaceFolder | undefined;
    public get workspaceFolder(): WorkspaceFolder | undefined {
        return this._workspaceFolder;
    }

    private _fileSystemController: FileSystemController | undefined;
    public get fileSystemController(): FileSystemController | undefined {
        return this._fileSystemController;
    }

    private _gitController: GitController | undefined;
    public get gitController(): GitController | undefined {
        return this._gitController;
    }

    private _firestoreController: FirestoreController | undefined;
    public get firestoreController(): FirestoreController | undefined {
        return this._firestoreController;
    }

    private _webviewController: Webview | undefined;
    public get webviewController(): Webview | undefined {
        return this._webviewController;
    }

    private _debugController: DebugController | undefined;
    public get debugController(): DebugController | undefined {
        return this._debugController;
    }

    private _languageServiceProvider: LanguageServiceProvider;
    public get languageServiceProvider(): LanguageServiceProvider {
        return this._languageServiceProvider;
    }

    private _copyBuffer: CopyBuffer | null = null;
    public get copyBuffer(): CopyBuffer | null {
        return this._copyBuffer;
    }

    private _clipboardCopyDisposable: Disposable | undefined;
    public get clipboardCopyDisposable(): Disposable | undefined {
        return this._clipboardCopyDisposable;
    }

    public get onInitComplete() {
        return this._onInitComplete.event;
    }

    public get onNodesComplete() {
        return this._onNodesComplete.event;
    }

    static async create(context: ExtensionContext) {
        const newContainer = new Container(context);
        const newFileParser = await FileParser.create(context, newContainer);
        newContainer._fileParser = newFileParser;
        const newGitController = await GitController.create(newContainer);
        newContainer._gitController = newGitController;
        const newFirestoreController = await FirestoreController.create(
            newContainer
        );
        newFirestoreController.onCopy((copyBuffer: CopyBuffer) => {
            newContainer._copyBuffer = copyBuffer;
        });
        newContainer._firestoreController = newFirestoreController;
        const newDebugController = DebugController.create(newContainer);
        newContainer._debugController = newDebugController;

        newContainer._disposables.push(
            newFileParser,
            newGitController,
            newFirestoreController,
            newDebugController
        );
        context.subscriptions.push({
            dispose: () =>
                newContainer._disposables
                    .reverse()
                    .forEach((d) => void d.dispose()),
        });

        // on init, fire events
        newContainer._onInitComplete.fire(newContainer);
        return newContainer;
    }

    public setWebviewController(webviewController: Webview) {
        this._webviewController = webviewController;
    }

    async initNodes() {
        if (this._fileSystemController) {
            await this._fileSystemController.readExtensionDirectory();
            this._onNodesComplete.fire(this);
        }
    }

    overriddenClipboardCopyAction(
        textEditor: TextEditor,
        edit: TextEditorEdit,
        params: any
    ) {
        // use the selected text that is being copied here
        // probably mark this in case the user copies from vs code into browser
        this._copyBuffer = null;

        //dispose of the overridden editor.action.clipboardCopyAction- back to default copy behavior
        this._clipboardCopyDisposable?.dispose();

        //execute the default editor.action.clipboardCopyAction to copy
        commands
            .executeCommand('editor.action.clipboardCopyAction')
            .then(() => {
                //add the overridden editor.action.clipboardCopyAction back
                this._clipboardCopyDisposable =
                    commands.registerTextEditorCommand(
                        'editor.action.clipboardCopyAction',
                        (
                            textEditor: TextEditor,
                            edit: TextEditorEdit,
                            params: any
                        ) =>
                            this.overriddenClipboardCopyAction(
                                textEditor,
                                edit,
                                params
                            )
                    );
                this._context.subscriptions.push(this._clipboardCopyDisposable);
            });
    }
}
