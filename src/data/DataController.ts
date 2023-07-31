import {
    Uri,
    Range,
    Disposable,
    window,
    workspace,
    TextDocumentContentChangeEvent,
} from 'vscode';
import { Container } from '../container';
import {
    AbstractTreeReadableNode,
    CompareSummary,
    SimplifiedTree,
} from '../tree/tree';
import ReadableNode from '../tree/node';
import LocationPlus, {
    ChangeEvent,
    TypeOfChange,
} from '../document/locationApi/location';
import { ListLogLine, DefaultLogFields } from 'simple-git';
import { DocumentData } from 'firebase/firestore';
import TimelineEvent from './timeline/TimelineEvent';
import { ParsedTsNode } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce } from '../utils/lib';
import { patienceDiffPlus } from '../utils/PatienceDiff';
import { CopyBuffer, VscodeChatGptData } from '../constants/types';
import MetaInformationExtractor from '../comments/CommentCreator';
import RangePlus from '../document/locationApi/range';
import { CodeComment, META_STATE } from '../comments/commentCreatorUtils';

export type LegalDataType = (DefaultLogFields & ListLogLine) | DocumentData; // not sure this is the right place for this but whatever

interface InitChatGptData {
    uri: Uri;
    textDocumentContentChangeEvent: TextDocumentContentChangeEvent;
}

interface ChangeBuffer {
    location: LocationPlus;
    typeOfChange: TypeOfChange;
    changeContent: string;
    time: number;
    diff:
        | {
              lines: any[];
              lineCountDeleted: number;
              lineCountInserted: number;
              lineCountMoved: number;
              aMove: any[];
              aMoveIndex: any[];
              bMove: any[];
              bMoveIndex: any[];
          }
        | {
              lines: any[];
              lineCountDeleted: number;
              lineCountInserted: number;
              lineCountMoved: number;
              aMove?: undefined;
              aMoveIndex?: undefined;
              bMove?: undefined;
              bMoveIndex?: undefined;
          };

    uid: string;
    changeInfo?: {
        newComments?: CodeComment[];
        removedComments?: CodeComment[];
        changedComments?: CodeComment[];
    };
}

export class DataController {
    // extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    _outputData: OutputDataController | undefined;
    _tree: SimplifiedTree<ReadableNode> | undefined;
    _metaInformationExtractor: MetaInformationExtractor;
    // _readableNode: ReadableNode;
    _chatGptData: VscodeChatGptData[] | undefined = [];
    _vscNodeMetadata: ParsedTsNode | undefined;
    _disposable: Disposable | undefined;
    _debug: boolean = false;
    _changeBuffer: ChangeBuffer[];

    constructor(
        private readonly readableNode: ReadableNode,
        private readonly container: Container,
        private readonly debug = false
    ) {
        // super();
        // this._readableNode = readableNode;
        this._changeBuffer = [];
        this.debug && console.log('MAKING META', this.readableNode);
        this._metaInformationExtractor = new MetaInformationExtractor(
            this.readableNode.languageId,
            this.readableNode.location.content,
            this.debug
        );
        this.debug && console.log('this', this);
        this.initListeners();
        this.debug && console.log('init complete');
    }

    // get readableNode() {
    //     return this._readableNode;
    // }

    // serialize() {
    //     return {
    //         readableNode: this.readableNode.serialize(),
    //     };
    // }

    // deserialize(data: any) {
    //     // would be better if deserialize was static
    //     this.readableNode = new ReadableNode(
    //         '',
    //         new LocationPlus(Uri.file(''), new Range(0, 0, 0, 0))
    //     ).deserialize(data.readableNode);
    //     return this.readableNode;
    // }

    compare(other: ReadableNode): CompareSummary<ReadableNode> {
        return this.readableNode.compare(other);
    }

    initListeners() {
        this._disposable = Disposable.from(
            this.readableNode.location.onChanged.event(
                debounce(async (changeEvent: ChangeEvent) => {
                    // console.log('hewwo???', location);
                    // console.log('this', this);
                    const location = changeEvent.location;
                    const newContent = location.content;
                    const oldContent =
                        changeEvent.previousRangeContent.oldContent;
                    // this._debug && console.log('chatgpt', this._chatGptData);
                    if (
                        // newContent.replace(/\s/g, '') ===
                        // oldContent.replace(/\s/g, '')
                        changeEvent.typeOfChange !==
                            TypeOfChange.CONTENT_ONLY &&
                        changeEvent.typeOfChange !==
                            TypeOfChange.RANGE_AND_CONTENT
                    ) {
                        return;
                    }

                    const editor =
                        window.activeTextEditor || window.visibleTextEditors[0];
                    const doc =
                        editor.document.uri.fsPath === location.uri.fsPath
                            ? editor.document
                            : await workspace.openTextDocument(location.uri); // idk when this would ever happen??? maybe in a git pull where a whole bunch of docs are being updated

                    const newNodeMetadata =
                        this.container.languageServiceProvider.parseCodeBlock(
                            newContent,
                            doc,
                            location
                        );
                    // console.log(
                    //     'newNodeMetadata',
                    //     newNodeMetadata,
                    //     'this',
                    //     this
                    // );
                    this._vscNodeMetadata = newNodeMetadata;
                    const diff = patienceDiffPlus(
                        oldContent.split(/[\[\](){}.,;:!?\s]/),
                        newContent.split(/[\[\](){}.,;:!?\s]/)
                    );
                    const oldComments =
                        this._metaInformationExtractor.foundComments;
                    this._metaInformationExtractor.updateMetaInformation(
                        newContent
                    );
                    this._metaInformationExtractor.foundComments.forEach(
                        (c) => {
                            c.location = (
                                this.readableNode.location.range as RangePlus
                            ).translate(c.location);
                        }
                    );
                    let commentInfo = undefined;
                    if (
                        oldComments.length !==
                        this._metaInformationExtractor.foundComments.length
                    ) {
                        commentInfo = {
                            newComments:
                                this._metaInformationExtractor.foundComments.filter(
                                    (c) => c.state && c.state === META_STATE.NEW
                                ),
                        };
                    }
                    this._changeBuffer.push({
                        ...(commentInfo && { changeInfo: commentInfo }), // condiiontal property add
                        ...{
                            diff,
                            location,
                            typeOfChange: changeEvent.typeOfChange,
                            changeContent: newContent,
                            time: Date.now(),
                            uid:
                                this.container.firestoreController?._user
                                    ?.uid || 'anonymous',
                        },
                    });
                    console.log('this!!!!', this);
                })
            ),
            this.readableNode.location.onSelected.event(
                async (location: LocationPlus) => {
                    // can probably break these out into their own pages
                    this._debug = true;
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

    addChatGptData(data: CopyBuffer, initChatGptData: InitChatGptData) {
        const { uri, textDocumentContentChangeEvent } = initChatGptData;
        console.log('gitcontroller', this.container.gitController);
        this._chatGptData?.push({
            ...data,
            location: new LocationPlus(
                uri,
                initChatGptData.textDocumentContentChangeEvent.range,
                {
                    rangeFromTextDocumentContentChangeEvent:
                        textDocumentContentChangeEvent,
                }
            ),
            pasteTime: Date.now(),
            // gitMetadata: this.container.gitController?.gitState,
            gitMetadata: null,
        });
        this._debug = true;
    }

    getGitData() {
        return this.container.gitController?.gitLog(this.readableNode.location);
    }

    async getFirestoreData() {
        return await this.container.firestoreController?.query(
            this.readableNode.id
        );
    }

    dispose() {
        this._disposable?.dispose();
    }

    set vscNodeMetadata(newNodeMetadata: ParsedTsNode) {
        this._vscNodeMetadata = newNodeMetadata;
    }

    get vscodeNodeMetadata() {
        return this._vscNodeMetadata;
    }

    get chatGptData() {
        return this._chatGptData;
    }

    set tree(newTree: SimplifiedTree<ReadableNode> | undefined) {
        this._tree = newTree;
    }

    get tree() {
        return this._tree;
    }
}
