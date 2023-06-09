import { Disposable, EventEmitter, TextEditor, window } from 'vscode';
import { Container } from '../container';
import GitController from './git/GitController';
import FirestoreController from './firestore/FirestoreController';

export class DataController extends Disposable {
    // private readonly container: Container;
    _disposable: Disposable[];
    _gitController: GitController | undefined;
    _firestoreController: FirestoreController | undefined;
    _onGitControllerInit: EventEmitter<GitController> =
        new EventEmitter<GitController>();

    // this can be accessed anywhere in the class with the "this" keyword -- TIL
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._firestoreController = undefined;
        this._gitController = undefined;

        this._disposable = [
            Disposable.from(
                window.onDidChangeActiveTextEditor(
                    this.onActiveEditorChanged,
                    this
                )
                // (this._gitController = new GitController(container))
                // (this._firestoreController = FirestoreController.create(container))
            ),
        ];
    }

    get gitController() {
        return this._gitController;
    }

    get firestoreController() {
        return this._firestoreController;
    }

    get onGitControllerInit() {
        return this._onGitControllerInit.event;
    }

    async onActiveEditorChanged(editor: TextEditor | undefined) {
        if (editor && this.container.fileParser) {
            console.log('editor changed', editor.document.fileName);
            const document = this.container.fileParser.docs.get(
                editor.document.uri.fsPath
            );
            if (
                !document &&
                this.container.fileParser.isTsJsTsxJsx(editor.document)
            ) {
                throw new Error(
                    `Data Controller: ${editor.document.fileName} not found`
                );
            }
            if (document) {
                console.log('document found', document);
                console.log(
                    'log',
                    await this._gitController?.gitLog(document.document)
                );
                // this.container.fileParser.getFilesToIgnore(editor.document);
                // this.container.fileParser.docs.push(document);
                // th
            }
        }
    }

    public static async create(container: Container) {
        const dataController = new DataController(container);
        const gitController = await GitController.create(container);
        const firestoreController = await FirestoreController.create(container); // event for this too?
        dataController._gitController = gitController;
        dataController._firestoreController = firestoreController;
        dataController._disposable.push(gitController, firestoreController);
        dataController._onGitControllerInit.fire(gitController);
        return dataController;
    }

    dispose() {
        this._disposable.forEach((d) => d.dispose());
    }
}
