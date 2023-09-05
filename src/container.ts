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
    Location,
    window,
} from 'vscode';
import { DataController } from './data/DataController';
import FileParser from './document/fileParser';
import FileSystemController from './fs/FileSystemController';
import GitController from './data/git/GitController';
import FirestoreController, {
    COMMIT_7227853_TIME,
    COMMIT_AMBER_2d7_MAX,
} from './data/firestore/FirestoreController';
// import TimelineController from './view/src/timeline/TimelineController';
import DebugController from './debug/debug';
import LanguageServiceProvider from './document/languageServiceProvider/LanguageServiceProvider';
import { CopyBuffer, SerializedReadableNode, UserMap } from './constants/types';
import LocationPlus from './document/locationApi/location';
import RangePlus from './document/locationApi/range';
import ViewLoader from './webviewPane/ViewLoader';
import DocumentWatcher from './document/documentWatcher';

export interface ClipboardMetadata {
    text: string;
    location: Location;
    time: number;
    webMetadata?: any;
    vscodeMetadata?: any;
}

export interface VSCClipboardMetadata {
    code: string;
    id: string;
    node: SerializedReadableNode;
}

export class Container {
    // https://stackoverflow.com/questions/59641564/what-are-the-differences-between-the-private-keyword-and-private-fields-in-types -- why # sign
    static #instance: Container;
    _disposables: Disposable[];
    _indexProjectDisposable: Disposable;
    _indexBlockDisposable: Disposable;
    _reindexFileDisposable: Disposable;
    _onInitComplete: EventEmitter<Container> = new EventEmitter<Container>();
    _onNodesComplete: EventEmitter<Container> = new EventEmitter<Container>();
    _onRead: EventEmitter<any> = new EventEmitter<any>();
    _onCopy: EventEmitter<ClipboardMetadata> =
        new EventEmitter<ClipboardMetadata>();
    _onPaste: EventEmitter<ClipboardMetadata> =
        new EventEmitter<ClipboardMetadata>();
    _resetTimes: EventEmitter<any> = new EventEmitter<any>();
    _resetTimesDisposable: Disposable;
    _indexBlockEmitter: EventEmitter<any> = new EventEmitter<any>();
    _reindexFileEmitter: EventEmitter<any> = new EventEmitter<any>();
    _onCommented: EventEmitter<any> = new EventEmitter<any>();
    _copyVscodeMetadata: VSCClipboardMetadata | null = null;
    // activeNode: DataController | null = null;
    activeFile: DocumentWatcher | null = null;
    // probably should add this and check on paste whether matches
    // and update appropriate datacontroller with metadata about movement
    // _onCut: EventEmitter<ClipboardMetadata> =
    //     new EventEmitter<ClipboardMetadata>();
    constructor(
        readonly context: ExtensionContext,
        readonly launchTime = Date.now()
    ) {
        console.log('CONTEXT', this.context);
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
        this._clipboardPasteDisposable = commands.registerTextEditorCommand(
            'editor.action.clipboardPasteAction',
            (textEditor: TextEditor, edit: TextEditorEdit, params: any) =>
                this.overriddenClipboardPasteAction(textEditor, edit, params)
        );
        this._commentDisposable = commands.registerTextEditorCommand(
            'editor.action.commentLine',
            (textEditor: TextEditor, edit: TextEditorEdit, params: any) =>
                this.overriddenCommentAction(textEditor, edit, params)
        );
        this._indexProjectDisposable = commands.registerCommand(
            'meta-manager.indexProject',
            () => {
                this._firestoreController?.indexProject();
            }
        );
        this._indexBlockDisposable = commands.registerCommand(
            'meta-manager.indexBlock',
            () => {
                this._indexBlockEmitter.fire({
                    selection: window.activeTextEditor?.selection,
                    text: window.activeTextEditor?.document.getText(
                        window.activeTextEditor?.selection
                    ),
                });
            }
        );
        this._reindexFileDisposable = commands.registerCommand(
            'meta-manager.reindexFile',
            () => {
                this._reindexFileEmitter.fire({
                    document: window.activeTextEditor?.document,
                });
            }
        );
        this._resetTimesDisposable = commands.registerCommand(
            'meta-manager.reset-time',
            () => {
                this._resetTimes.fire({
                    // commit: '1ee023f442fcb0d882d0c37d8c3e32ea7fa7f864',
                    commit: '4a9e4fe7a4ddba48d42fde2917f521eb662e7778',
                    range: [COMMIT_AMBER_2d7_MAX, COMMIT_7227853_TIME],
                });
            }
        );
        this._loggedInUserMap = {
            firestoreEmail: '',
            firestoreUid: '',
            firestoreDisplayName: '',
            gitEmail: '',
            gitName: '',
            githubLogin: '',
            githubUid: '',
        };
        this._disposables.push(
            // (this._dataController = new DataController(this))
            // (this._fileParser = FileParser.createFileParser(context, this)) // new FileParser(context, this))
            this._clipboardCopyDisposable,
            this._clipboardPasteDisposable,
            this._commentDisposable,
            this._indexProjectDisposable,
            this._indexBlockDisposable
        );
        // this._context = context;
    }

    private _fileParser: FileParser | undefined;
    public get fileParser(): FileParser | undefined {
        return this._fileParser;
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

    private _sidePaneWebviewController: ViewLoader | undefined;
    public get sidePaneWebviewController(): ViewLoader | undefined {
        return this._sidePaneWebviewController;
    }

    set sidePaneWebviewController(viewLoader: ViewLoader | undefined) {
        this._sidePaneWebviewController = viewLoader;
    }

    private _activeNode: DataController | null = null;
    public get activeNodeController(): DataController | null {
        return this._activeNode;
    }
    set activeNode(dataController: DataController | null) {
        this._activeNode = dataController;
    }

    private _activeDocument: DocumentWatcher | null = null;
    public get activeDocument(): DocumentWatcher | null {
        return this._activeDocument;
    }
    set activeDocument(activeDocument: DocumentWatcher | null) {
        this._activeDocument = activeDocument;
    }

    private _debugController: DebugController | undefined;
    public get debugController(): DebugController | undefined {
        return this._debugController;
    }

    private _languageServiceProvider: LanguageServiceProvider;
    public get languageServiceProvider(): LanguageServiceProvider {
        return this._languageServiceProvider;
    }

    private _loggedInUserMap: UserMap;
    public get loggedInUser(): UserMap {
        return this._loggedInUserMap;
    }

    set loggedInUserMap(userMap: UserMap) {
        this._loggedInUserMap = userMap;
    }

    private _copyBuffer: CopyBuffer | null = null;
    public get copyBuffer(): CopyBuffer | null {
        return this._copyBuffer;
    }

    private _clipboardCopyDisposable: Disposable | undefined;
    public get clipboardCopyDisposable(): Disposable | undefined {
        return this._clipboardCopyDisposable;
    }

    private _clipboardPasteDisposable: Disposable | undefined;
    public get clipboardPasteDisposable(): Disposable | undefined {
        return this._clipboardCopyDisposable;
    }

    private _commentDisposable: Disposable | undefined;
    public get commentDisposable(): Disposable | undefined {
        return this._commentDisposable;
    }

    public get onInitComplete() {
        return this._onInitComplete.event;
    }

    public get onNodesComplete() {
        return this._onNodesComplete.event;
    }

    public get onCopy() {
        return this._onCopy.event;
    }

    public get onPaste() {
        return this._onPaste.event;
    }

    public get onRead() {
        return this._onRead.event;
    }

    public get onCommented() {
        return this._onCommented.event;
    }

    public get indexBlockEmitter() {
        return this._indexBlockEmitter.event;
    }

    public get reindexFileEmitter() {
        return this._reindexFileEmitter.event;
    }

    public get resetTimesEmitter() {
        return this._resetTimes.event;
    }

    static async create(context: ExtensionContext) {
        const newContainer = new Container(context);
        const newFileParser = await FileParser.create(context, newContainer);
        newContainer._fileParser = newFileParser;
        const newGitController = await GitController.create(newContainer);
        newContainer._loggedInUserMap = {
            ...newContainer._loggedInUserMap,
            githubLogin: newGitController.authSession!.account.label,
        };
        newContainer._gitController = newGitController;
        const newFirestoreController = await FirestoreController.create(
            newContainer
        );
        newContainer._loggedInUserMap = newFirestoreController._user
            ? {
                  ...newContainer._loggedInUserMap,
                  firestoreEmail: newFirestoreController._user.email || '',
                  firestoreUid: newFirestoreController._user.uid || '',
                  firestoreDisplayName:
                      newFirestoreController._user.displayName || '',
              }
            : newContainer._loggedInUserMap;
        newFirestoreController.onCopy((copyBuffer: CopyBuffer) => {
            newContainer._copyBuffer = copyBuffer;
        });
        newFirestoreController.onRead((event) => {
            newContainer._onRead.fire(event);
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

    public setCopyBuffer(copyBuffer: CopyBuffer) {
        this._copyBuffer = copyBuffer;
    }

    async initNodes() {
        if (this._firestoreController) {
            // await this._fileSystemController.readExtensionDirectory();
            // this._onNodesComplete.fire(this);
            // await this._firestoreController.initProject();
        }
    }

    async overriddenCommentAction(
        textEditor: TextEditor,
        edit: TextEditorEdit,
        params: any
    ) {
        this._commentDisposable?.dispose();
        commands.executeCommand('editor.action.commentLine').then(() => {
            // commands
            //     .executeCommand('editor.action.clipboardPasteAction')
            //     .then(() => {
            //add the overridden editor.action.clipboardCopyAction back
            this._commentDisposable = commands.registerTextEditorCommand(
                'editor.action.commentLine',
                (textEditor: TextEditor, edit: TextEditorEdit, params: any) =>
                    this.overriddenCommentAction(textEditor, edit, params)
            );
            this.context.subscriptions.push(this._commentDisposable);
            // });
            const location: Location = new Location(
                textEditor.document.uri,
                RangePlus.fromRange(textEditor.selection)
            );
            const commentedText = textEditor.document.getText(
                textEditor.selection
            );
            console.log('COMMENTED!!!!!', commentedText);
            this._onCommented.fire({
                // text: pastedText,
                location,
                time: Date.now(),
                text: commentedText,
            });
            // this._copyVscodeMetadata = null;
        });
    }

    async overriddenClipboardPasteAction(
        textEditor: TextEditor,
        edit: TextEditorEdit,
        params: any
    ) {
        const pastedText = await env.clipboard.readText();
        console.log(
            'overriddenClipboardPasteAction',
            textEditor,
            edit,
            params,
            pastedText,
            this
        );

        this._clipboardPasteDisposable?.dispose();
        commands
            .executeCommand('editor.action.clipboardPasteAction')
            .then(() => {
                // commands
                //     .executeCommand('editor.action.clipboardPasteAction')
                //     .then(() => {
                //add the overridden editor.action.clipboardCopyAction back
                this._clipboardPasteDisposable =
                    commands.registerTextEditorCommand(
                        'editor.action.clipboardPasteAction',
                        (
                            textEditor: TextEditor,
                            edit: TextEditorEdit,
                            params: any
                        ) =>
                            this.overriddenClipboardPasteAction(
                                textEditor,
                                edit,
                                params
                            )
                    );
                this.context.subscriptions.push(this._clipboardPasteDisposable);
                // });
                const location: Location = new Location(
                    textEditor.document.uri,
                    RangePlus.fromRangeAndText(
                        textEditor.selection,
                        pastedText
                    ).toRange()
                );

                this._onPaste.fire({
                    text: pastedText,
                    location,
                    time: Date.now(),
                    vscodeMetadata: this._copyVscodeMetadata,
                });
            });
    }

    overriddenClipboardCopyAction(
        textEditor: TextEditor,
        edit: TextEditorEdit,
        params: any
    ) {
        // use the selected text that is being copied here
        // probably mark this in case the user copies from vs code into browser
        // tbd on if we want to use copyBuffer for also keeping track of in-editor copy/paste
        // probably????
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
                this.context.subscriptions.push(this._clipboardCopyDisposable);
                const copiedText = textEditor.document.getText(
                    textEditor.selection
                );
                const location: LocationPlus = new LocationPlus(
                    textEditor.document.uri,
                    textEditor.selection
                );

                this._onCopy.fire({
                    text: copiedText,
                    location,
                    time: Date.now(),
                });
            });
    }

    updateClipboardMetadata(copyVscodeMetadata: VSCClipboardMetadata) {
        this._copyVscodeMetadata = copyVscodeMetadata;
    }
}
