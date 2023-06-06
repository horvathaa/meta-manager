import { Disposable, TextEditor, window } from 'vscode';
import { Container } from '../container';
import GitController from './GitController';

export class DataController extends Disposable {
    // private readonly container: Container;
    _disposable: Disposable;
    _gitController: GitController;

    // this can be accessed anywhere in the class with the "this" keyword -- TIL
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._disposable = Disposable.from(
            window.onDidChangeActiveTextEditor(
                this.onActiveEditorChanged,
                this
            ),
            (this._gitController = new GitController(container))
        );
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
                throw new Error('Document not found');
            }
            if (document) {
                console.log('document found', document);
                console.log(
                    'log',
                    await this._gitController.gitLog(document.document)
                );
                // this.container.fileParser.getFilesToIgnore(editor.document);
                // this.container.fileParser.docs.push(document);
                // th
            }
        }
    }

    dispose() {
        throw new Error('Method not implemented.');
    }
}
