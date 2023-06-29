import {
    Disposable,
    EventEmitter,
    ExtensionContext,
    Webview,
    WorkspaceFolder,
    workspace,
} from 'vscode';
import { DataController } from './data/DataController';
import FileParser from './document/fileParser';
import FileSystemController from './fs/FileSystemController';
import GitController from './data/git/GitController';
import FirestoreController from './data/firestore/FirestoreController';
import TimelineController from './view/src/timeline/TimelineController';
import DebugController from './debug/debug';

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
        this._disposables
            .push
            // (this._dataController = new DataController(this))
            // (this._fileParser = FileParser.createFileParser(context, this)) // new FileParser(context, this))
            ();
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
}
