import { Uri, Range, Disposable, window, workspace } from 'vscode';
import { Container } from '../container';
import { AbstractTreeReadableNode, CompareSummary } from '../tree/tree';
import ReadableNode from '../tree/node';
import LocationPlus from '../document/locationApi/location';
import { ListLogLine, DefaultLogFields } from 'simple-git';
import { DocumentData } from 'firebase/firestore';
import TimelineEvent from './timeline/TimelineEvent';
import { VscodeTsNodeMetadata } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce } from '../lib';

export type LegalDataType = (DefaultLogFields & ListLogLine) | DocumentData; // not sure this is the right place for this but whatever

export class DataController extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    _outputData: OutputDataController | undefined;
    _readableNode: ReadableNode;
    _vscNodeMetadata: VscodeTsNodeMetadata[];
    _disposable: Disposable | undefined;

    constructor(
        readableNode: ReadableNode,
        private readonly container: Container
    ) {
        super();
        this._readableNode = readableNode;
        this._vscNodeMetadata = [];
        this.initListeners();
    }

    get readableNode() {
        return this._readableNode;
    }

    serialize() {
        return {
            readableNode: this._readableNode.serialize(),
        };
    }

    deserialize(data: any) {
        // would be better if deserialize was static
        this._readableNode = new ReadableNode(
            '',
            new LocationPlus(Uri.file(''), new Range(0, 0, 0, 0))
        ).deserialize(data.readableNode);
        return this._readableNode;
    }

    compare(other: ReadableNode): CompareSummary<ReadableNode> {
        return this._readableNode.compare(other);
    }

    initListeners() {
        this._disposable = Disposable.from(
            this._readableNode.location.onChanged.event(
                debounce(async (location: LocationPlus) => {
                    console.log('hewwo???', location);
                    const newContent = location.content;
                    const oldContent = this._readableNode.location.content;
                    console.log(
                        'newContent',
                        newContent.replace(/\s/g, ''),
                        'oldContent',
                        oldContent.replace(/\s/g, '')
                    );
                    if (
                        newContent.replace(/\s/g, '') ===
                        oldContent.replace(/\s/g, '')
                    ) {
                        return;
                    }
                    const editor =
                        window.activeTextEditor || window.visibleTextEditors[0];
                    const doc =
                        editor.document.uri.fsPath === location.uri.fsPath
                            ? editor.document
                            : await workspace.openTextDocument(location.uri);

                    const newNodeMetadata =
                        this.container.languageServiceProvider.parseCodeBlock(
                            newContent,
                            doc
                        );
                    console.log(
                        'old',
                        this.vscNodeMetadata,
                        'newNodeMetadata',
                        newNodeMetadata
                    );
                    this.vscNodeMetadata = newNodeMetadata;
                })
            ),
            this._readableNode.location.onSelected.event(
                async (location: LocationPlus) => {
                    // can probably break these out into their own pages
                    const gitRes = (await this.getGitData())?.all || [];
                    if (gitRes.length > 0) {
                        this._gitData = gitRes.map((r) => new TimelineEvent(r));
                    } else {
                        this._gitData = [];
                    }
                    const fireStoreRes = (await this.getFirestoreData()) || [];
                    if (fireStoreRes.length > 0) {
                        this._firestoreData = fireStoreRes.map(
                            (r) => new TimelineEvent(r)
                        );
                    } else {
                        this._firestoreData = [];
                    }
                    const allData = [...this._firestoreData, ...this._gitData];
                    this.container.webviewController?.postMessage({
                        command: 'updateTimeline',
                        data: {
                            id: this.readableNode.id,
                            timelineData: allData,
                        },
                    });
                    // console.log('this', this, 'location', location);
                }
            )
        );
        return () => this.dispose();
    }

    getGitData() {
        return this.container.gitController?.gitLog(
            this._readableNode.location
        );
    }

    async getFirestoreData() {
        return await this.container.firestoreController?.query(
            this._readableNode.id
        );
    }

    dispose() {
        this._disposable?.dispose();
    }

    set vscNodeMetadata(newNodeMetadata: VscodeTsNodeMetadata[]) {
        this._vscNodeMetadata = newNodeMetadata;
    }

    get vscodeNodeMetadata() {
        return this._vscNodeMetadata;
    }
}
