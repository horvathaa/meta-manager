import {
    Disposable,
    EventEmitter,
    ExtensionContext,
    WorkspaceFolder,
    workspace,
} from 'vscode';
import { DataController } from './data/DataController';
import FileParser from './document/fileParser';
import FileSystemController from './fs/FileSystemController';

export class Container {
    // https://stackoverflow.com/questions/59641564/what-are-the-differences-between-the-private-keyword-and-private-fields-in-types -- why # sign
    static #instance: Container;
    _disposables: Disposable[];
    _onDataControllerInit: EventEmitter<DataController> =
        new EventEmitter<DataController>();

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

    private _dataController: DataController | undefined;
    public get dataController(): DataController | undefined {
        return this._dataController;
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

    public get onDataControllerInit() {
        return this._onDataControllerInit.event;
    }

    static async create(context: ExtensionContext) {
        const newContainer = new Container(context);
        const newFileParser = await FileParser.create(context, newContainer);
        newContainer._fileParser = newFileParser;
        const newDataController = await DataController.create(newContainer);
        newContainer._dataController = newDataController;

        newContainer._disposables.push(newFileParser, newDataController);
        context.subscriptions.push({
            dispose: () =>
                newContainer._disposables
                    .reverse()
                    .forEach((d) => void d.dispose()),
        });

        // on init, fire events
        newContainer._onDataControllerInit.fire(newDataController);
        return newContainer;
        // return (Container.#instance = new Container(context));
    }
}
