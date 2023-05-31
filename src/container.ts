import {
    Disposable,
    ExtensionContext,
    WorkspaceFolder,
    workspace,
} from 'vscode';
import { DataController } from './data/DataController';
import FileParser from './document/fileParser';

export class Container {
    // https://stackoverflow.com/questions/59641564/what-are-the-differences-between-the-private-keyword-and-private-fields-in-types -- why # sign
    static #instance: Container;
    _disposables: Disposable[];

    private readonly _context: ExtensionContext;
    constructor(context: ExtensionContext) {
        this._disposables = [];
        this._workspaceFolder = workspace.workspaceFolders
            ? workspace.workspaceFolders[0]
            : undefined;
        this._disposables.push(
            (this._dataController = new DataController(this))
            // (this._fileParser = FileParser.createFileParser(context, this)) // new FileParser(context, this))
        );
        this._context = context;
    }

    private _fileParser: FileParser | undefined;
    public get fileParser(): FileParser | undefined {
        return this._fileParser;
    }

    private _dataController: DataController;
    public get dataController(): DataController {
        return this._dataController;
    }

    public get context(): ExtensionContext {
        return this._context;
    }

    private _workspaceFolder: WorkspaceFolder | undefined;
    public get workspaceFolder(): WorkspaceFolder | undefined {
        return this._workspaceFolder;
    }

    static async create(context: ExtensionContext) {
        const newContainer = new Container(context);
        newContainer._disposables.push(
            (newContainer._fileParser = await FileParser.createFileParser(
                context,
                newContainer
            ))
        );
        context.subscriptions.push({
            dispose: () =>
                newContainer._disposables
                    .reverse()
                    .forEach((d) => void d.dispose()),
        });
        return newContainer;
        // return (Container.#instance = new Container(context));
    }
}
