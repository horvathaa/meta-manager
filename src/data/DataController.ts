import { Disposable, TextEditor, window } from 'vscode';
import { Container } from '../container';

export class DataController extends Disposable {
    // private readonly container: Container;
    _disposable: Disposable;

    // this can be accessed anywhere in the class with the "this" keyword -- TIL
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._disposable = Disposable.from(
            window.onDidChangeActiveTextEditor(this.onActiveEditorChanged, this)
        );

        // this.container // = container;
    }

    onActiveEditorChanged(editor: TextEditor | undefined) {}

    dispose() {
        throw new Error('Method not implemented.');
    }
}
