import {
    Disposable,
    Location,
    Position,
    TextDocumentChangeEvent,
    Uri,
    Range,
    workspace,
    window,
    EventEmitter,
    TextEditor,
    TextEditorDecorationType,
    DecorationRenderOptions,
    TextEditorSelectionChangeEvent,
} from 'vscode';
import RangePlus, { SerializedRangePlus } from './range';

export interface LocationPlusOptions {
    id?: string;
    textEditorDecoration?: TextEditorDecorationType;
}

export interface SerializedLocationPlus {
    fsPath: string;
    range: SerializedRangePlus;
    content: string;
    id?: string;
}

export default class LocationPlus extends Location {
    _disposable: Disposable;
    _range: RangePlus;
    _content: string;
    _id?: string;
    _textEditorDecoration?: TextEditorDecorationType;
    onDelete: EventEmitter<LocationPlus> = new EventEmitter<LocationPlus>();
    onChanged: EventEmitter<LocationPlus> = new EventEmitter<LocationPlus>();
    onSelected: EventEmitter<LocationPlus> = new EventEmitter<LocationPlus>();
    constructor(
        uri: Uri,
        rangeOrPosition: Range | Position,
        opts?: LocationPlusOptions
    ) {
        super(uri, rangeOrPosition);

        this._range =
            rangeOrPosition instanceof Range
                ? RangePlus.fromRange(rangeOrPosition)
                : rangeOrPosition instanceof Position
                ? RangePlus.fromPosition(rangeOrPosition)
                : RangePlus.fromLineNumbers(0, 0, 0, 0); // may just want to throw an error instead
        this._disposable = Disposable.from(
            workspace.onDidChangeTextDocument(this.onTextDocumentChanged, this),
            window.onDidChangeActiveTextEditor(
                this.onDidChangeActiveTextEditor,
                this
            ),
            window.onDidChangeVisibleTextEditors(
                this.onDidChangeVisibleTextEditors,
                this
            ),
            window.onDidChangeTextEditorSelection(
                this.onDidChangeTextEditorSelection,
                this
            ),
            this._range.onDelete.event((range: RangePlus) => {
                this._disposable.dispose();
                this.onDelete.fire(this);
            })
        );
        this._content = '';
        if (opts) {
            opts.id && this.setId(opts.id);
            opts.textEditorDecoration &&
                this.setTextEditorDecoration(opts.textEditorDecoration);
        }
    }

    public static fromLocation(location: Location, opts?: LocationPlusOptions) {
        return new LocationPlus(location.uri, location.range, opts);
    }

    dispose() {
        this._disposable.dispose();
    }

    get content(): string {
        return this._content;
    }

    get id(): string | undefined {
        return this._id;
    }

    public setId(id: string) {
        if (!this._id) {
            this._id = id;
        } else {
            throw new Error('Cannot set id more than once');
        }
    }

    get textEditorDecoration(): TextEditorDecorationType | undefined {
        return this._textEditorDecoration;
    }

    public setTextEditorDecoration(
        textEditorDecoration: TextEditorDecorationType | undefined
    ) {
        this._textEditorDecoration = textEditorDecoration;
    }

    createTextEditorDecorationType(renderOpts: DecorationRenderOptions) {
        this._textEditorDecoration =
            window.createTextEditorDecorationType(renderOpts);
    }

    private applyDecorations(textEditor: TextEditor) {
        if (this._textEditorDecoration) {
            textEditor.setDecorations(this._textEditorDecoration, [
                this._range,
            ]);
        }
    }

    private updateContent(textEditor: TextEditor) {
        this._content = textEditor.document.getText(this._range);
    }

    onTextDocumentChanged(onTextDocumentChanged: TextDocumentChangeEvent) {
        const { document, contentChanges } = onTextDocumentChanged;
        if (this.uri.fsPath === document.uri.fsPath) {
            for (const change of contentChanges) {
                const oldRange = this._range.copy();
                this._range = RangePlus.fromRange(
                    document.validateRange(this._range.update(change))
                );
                const furtherNormalizedStart =
                    document.getWordRangeAtPosition(this._range.start) ||
                    this._range;
                const furtherNormalizedEnd =
                    document.getWordRangeAtPosition(this._range.end) ||
                    this._range;
                this._range = RangePlus.fromPositions(
                    furtherNormalizedStart.start,
                    furtherNormalizedEnd.end
                );
                if (!this._range.isEqual(oldRange)) {
                    this.onChanged.fire(this);
                }
                this.range = this._range;
                this._range.updateRangeLength(document);
                this._content = document.getText(this._range);
            }
        }
    }

    onDidChangeActiveTextEditor(textEditor: TextEditor | undefined) {
        if (textEditor && textEditor.document.uri.fsPath === this.uri.fsPath) {
            this.updateContent(textEditor);
            this.applyDecorations(textEditor);
        }
    }

    onDidChangeVisibleTextEditors(textEditors: readonly TextEditor[]) {
        const matchingEditor = textEditors.find(
            (textEditor) => textEditor.document.uri.fsPath === this.uri.fsPath
        );
        if (matchingEditor) {
            this.updateContent(matchingEditor);
            this.applyDecorations(matchingEditor);
        }
    }

    onDidChangeTextEditorSelection(
        selectionEvent: TextEditorSelectionChangeEvent
    ) {
        if (selectionEvent.textEditor.document.uri.fsPath === this.uri.fsPath) {
            const { selections } = selectionEvent;
            const selection = selections[0];
            if (this._range.contains(selection.active)) {
                this.onSelected.fire(this);
            }
        }
    }

    serialize(): SerializedLocationPlus {
        return {
            fsPath: this.uri.fsPath,
            range: this._range.serialize(),
            content: this._content,
        };
    }

    static deserialize(serializedLocationPlus: SerializedLocationPlus) {
        // tbd what to do with content here
        const { fsPath, range, content, id } = serializedLocationPlus;
        return id
            ? new LocationPlus(Uri.file(fsPath), RangePlus.deserialize(range), {
                  id,
              })
            : new LocationPlus(Uri.file(fsPath), RangePlus.deserialize(range));
    }
}
