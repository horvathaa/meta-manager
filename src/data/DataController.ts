import {
    Uri,
    Range,
    Disposable,
    window,
    workspace,
    TextDocumentContentChangeEvent,
    commands,
    TextEditor,
    TextEditorEdit,
    TextDocument,
    Selection,
    Location,
} from 'vscode';
import { ClipboardMetadata, Container } from '../container';
import {
    AbstractTreeReadableNode,
    CompareSummary,
    NodeWithChildren,
    SimplifiedTree,
    getSimplifiedTreeName,
} from '../tree/tree';
import ReadableNode, {
    NodeState,
    TypeOfChangeToNodeState,
    nodeContentChange,
} from '../tree/node';
import LocationPlus, {
    ChangeEvent,
    TypeOfChange,
} from '../document/locationApi/location';
import { ListLogLine, DefaultLogFields } from 'simple-git';
import {
    CollectionReference,
    DocumentData,
    DocumentReference,
} from 'firebase/firestore';
import TimelineEvent, { GitType } from './timeline/TimelineEvent';
import { ParsedTsNode } from '../document/languageServiceProvider/LanguageServiceProvider';
import { debounce, isLocation } from '../utils/lib';
import { patienceDiffPlus } from '../utils/PatienceDiff';
import {
    ChangeBuffer,
    CopyBuffer,
    Diff,
    Event,
    PasteDetails,
    SerializedChangeBuffer,
    SerializedDataController,
    SerializedDataControllerEvent,
    SerializedLocationPlus,
    SerializedNodeDataController,
    SerializedReadableNode,
    THEME_COLORS,
    TrackedPasteDetails,
    VscodeCopyBuffer,
    WebviewData,
    getColorTheme,
} from '../constants/types';
import MetaInformationExtractor from '../comments/CommentCreator';
import RangePlus from '../document/locationApi/range';
import { CodeComment, META_STATE } from '../comments/commentCreatorUtils';
import { CurrentGitState } from './git/GitController';
import * as ts from 'typescript';
import { v4 as uuidv4 } from 'uuid';
import { getProjectName, getVisiblePath } from '../document/lib';
// import { nodeToRange } from '../document/lib';
const tstraverse = require('tstraverse');
export type LegalDataType =
    | (DefaultLogFields & ListLogLine)
    | DocumentData
    | SerializedChangeBuffer
    | GitType; // not sure this is the right place for this but whatever

interface PasteData {
    uri: Uri;
    textDocumentContentChangeEvent: TextDocumentContentChangeEvent;
}

export interface FirestoreControllerInterface {
    ref: DocumentReference<DocumentData>;
    pastVersionsCollection: CollectionReference<DocumentData>;
    write: (newNode: any) => void;
    logVersion: (versionId: string, newNode: any) => void;
    readPastVersions: () => Promise<SerializedChangeBuffer[]>;
}

export class DataController {
    // extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    // _outputData: OutputDataController | undefined;
    _firestoreControllerInterface: FirestoreControllerInterface | undefined;
    _tree: SimplifiedTree<ReadableNode> | undefined;
    _metaInformationExtractor: MetaInformationExtractor;
    _pastVersions: SerializedChangeBuffer[] = [];
    // _readableNode: ReadableNode;
    // _chatGptData: VscodeCopyBuffer[] | undefined = [];
    _webMetaData: VscodeCopyBuffer[] = [];
    _vscNodeMetadata: ParsedTsNode | undefined;
    _disposable: Disposable | undefined;
    _debug: boolean = false;
    _emit: boolean = false;
    _seen: boolean = false;
    _new: boolean = false;
    _displayName: string = '';
    _didPaste: PasteDetails | null = null;
    _changeBuffer: ChangeBuffer[];
    _ownedLocations: LocationPlus[] = [];
    _webviewData: WebviewData | undefined;
    _pasteLocations: TrackedPasteDetails[] = [];
    // _pasteDisposable: Disposable;

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
            this.debug,
            this.readableNode.location.uri
        );
        this._displayName = this.readableNode.id.split(':')[0];
        this.debug && console.log('this', this);
        // this._pasteDisposable =
        this.initListeners();
        this.debug && console.log('init complete');
        this._webviewData = this.formatWebviewData();
    }

    compare(other: ReadableNode): CompareSummary<ReadableNode> {
        return this.readableNode.compare(other);
    }

    setTree(tree: SimplifiedTree<ReadableNode>) {
        this._tree = tree;
        this.readableNode.id === 'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}' &&
            console.log('tree set', this._tree);
    }

    setDisplayName(displayName: string) {
        this._displayName = displayName;
    }

    initListeners() {
        this._disposable = Disposable.from(
            // this._pasteDisposable,
            // tbd how much info to copy in the copy event -- probably would need
            // to transmit back to container? put in copy buffer
            this.container.onCopy((copyEvent) => {
                if (
                    this.readableNode.location.containsPartOf(
                        copyEvent.location
                    )
                ) {
                    this.handleOnCopy(copyEvent);
                }
            }),
            // same questions as above for paste -- what to save
            // from console logs it seems like this event gets fired before the
            // on change but that's probably due to the debounce for that...?
            // tbd
            this.container.onPaste((pasteEvent) => {
                if (
                    this.readableNode.location.containsStart(
                        pasteEvent.location
                    )
                ) {
                    this.handleOnPaste(pasteEvent);
                }
            }),
            this.container.onCommented((commentEvent) => {
                if (this.isContained(commentEvent.location)) {
                    this.handleOnCommented(commentEvent);
                }
            }),
            this.readableNode.location.onChanged.event(
                // debounce(async (changeEvent: ChangeEvent) => {
                (changeEvent: ChangeEvent) => this.handleOnChange(changeEvent)
            ),
            // ),
            this.readableNode.location.onSelected.event(
                async (location: Selection) => {
                    // can probably break these out into their own pages
                    this.handleOnSelected(location);
                }
            ),
            workspace.onDidSaveTextDocument((document) => {
                if (
                    document.uri.fsPath ===
                    this.readableNode.location.uri.fsPath
                    //     &&
                    // this._changeBuffer.length > 0
                ) {
                    this.handleOnSaveTextDocument(document);
                }
            }),
            window.onDidChangeActiveTextEditor((editor) => {
                // console.log('is this getting called lol', document);
                this.handleOnDidChangeActiveTextEditor(editor?.document);
            })
        );
        return () => this.dispose();
    }

    parseDiff(diff: Diff) {
        // console.log('diff', diff);
        const removedLines = diff.lines.filter((l) => l.bIndex === -1);
        const removedCode = removedLines.map((l) => l.line).join('\n');
        const addedLines = diff.lines.filter((l) => l.aIndex === -1);
        const addedCode = addedLines.map((l) => l.line).join('\n');
        let diffState = {
            addedBlock: false,
            removedBlock: false,
        };
        if (addedCode.includes('{') && addedCode.includes('}')) {
            diffState.addedBlock = true;
            // if(this._tree && this._tree.isLeaf || this._tree?.root?.children.some(c => c.root?.data.lo))
        }
        if (removedCode.includes('{') && removedCode.includes('}')) {
            diffState.removedBlock = true;
        }
        return diffState;
    }

    private initReadableNode(
        readableNodeParam: ReadableNode,
        name: string,
        changeBuffer?: ChangeBuffer
    ) {
        const readableNode = readableNodeParam.copy();
        readableNode.dataController = new DataController(
            readableNode,
            this.container
        );
        readableNode.setId(name);
        readableNode.registerListeners();
        readableNode.dataController._firestoreControllerInterface =
            this.container.firestoreController!.createNodeMetadata(
                name,
                this.container.firestoreController!.getFileCollectionPath(
                    getVisiblePath(
                        workspace.name ||
                            getProjectName(
                                this.readableNode.location.uri.toString()
                            ),
                        this.readableNode.location.uri.fsPath,
                        this.container.context.extensionUri
                    )
                )
            );

        // const tree = this._tree?.insert(readableNode, {
        //     name: readableNode.id,
        // });
        // readableNode.dataController._tree = tree;
        changeBuffer &&
            readableNode.dataController._changeBuffer.push(changeBuffer);
        return readableNode;
    }

    handleInsertBlock(
        addedContent: string,
        insertedRange: Range,
        changeBuffer?: ChangeBuffer
    ) {
        console.log(
            'INSERTING  NEW BLOCK',
            addedContent,
            insertedRange,
            changeBuffer
        );
        if (this.isOwnerOfRange(insertedRange)) {
            const sourceFile = ts.createSourceFile(
                this.readableNode.location.uri.fsPath,
                addedContent,
                ts.ScriptTarget.Latest,
                true
            );
            setTimeout(() => {
                this.evenSimplerTraverse(
                    sourceFile,
                    window.activeTextEditor?.document ||
                        window.visibleTextEditors[0].document,
                    changeBuffer
                );
            }, 3000);
        }
    }

    handleUpdateChangeBuffer(
        oldContent: string,
        newContent: string,
        changeEvent: ChangeEvent
    ) {
        const { addedContent, insertedRange } = changeEvent;
        if (
            addedContent &&
            insertedRange &&
            addedContent.includes('{') &&
            addedContent.includes('}') &&
            (!this._didPaste ||
                !addedContent.includes(this._didPaste.pasteContent)) && // yeesh not good
            addedContent !== this.readableNode.location.content
        ) {
            console.log(
                'this._didPaste',
                this._didPaste,
                'added',
                addedContent
            );
            this._debug = true;
            if (this._didPaste) {
                this.handleInsertBlock(
                    this._didPaste.pasteContent,
                    this._didPaste.location.range
                );
            } else {
                this.handleInsertBlock(addedContent, insertedRange);
            }
        }

        const diff = patienceDiffPlus(
            oldContent.split(/\n/),
            newContent.split(/\n/)
        );
        const { addedBlock, removedBlock } = this.parseDiff(diff);
        const oldComments = this._metaInformationExtractor.foundComments;
        // console.log('newContent', newContent, this);
        this._metaInformationExtractor.updateMetaInformation(newContent);

        this._metaInformationExtractor.foundComments.forEach((c) => {
            (c.location as LocationPlus)._range = (
                this.readableNode.location.range as RangePlus
            ).translate(c.location.range as Range);
            (c.associatedCode as LocationPlus)._range = (
                this.readableNode.location.range as RangePlus
            ).translate((c.associatedCode as LocationPlus).range as Range);
            console.log('c.location', c);
        });
        // const commentedLines =
        //     this._metaInformationExtractor.getCommentedLines();
        // // console.log('commented lines', commentedLines);
        // // const rangeLines = (
        // //     this.readableNode.location.range as RangePlus
        // ).getLineNumbers();
        // // const mainRangeLines = rangeLines.slice(1, rangeLines.length - 1);
        // console.log(
        //     'commented',
        //     this._metaInformationExtractor.foundComments,
        //     'lines',
        //     commentedLines,
        //     'range',
        //     rangeLines
        // );

        let commentInfo = undefined;
        if (
            oldComments.length !==
            this._metaInformationExtractor.foundComments.length
        ) {
            console.log(
                'in here',
                this._metaInformationExtractor.foundComments
            );
            // commentInfo = {
            //     newComments: this._metaInformationExtractor.foundComments,
            // };
            commentInfo = {
                newComments:
                    this._metaInformationExtractor.foundComments.filter((c) => {
                        const sourceFile = ts.createSourceFile(
                            this.readableNode.location.uri.fsPath,
                            c.text.split(c.splitter || '//')[1],
                            ts.ScriptTarget.Latest,
                            true
                        );

                        // @ts-ignore
                        return sourceFile.parseDiagnostics.every(
                            (c: any) => c.code === 1434
                        );
                    }),
            };
        }
        console.log('new comments', commentInfo);
        // update this to use removedContent, addedContent,
        // isInsertion, isRemoval, etc.
        // then send to view so we can have slightly better messages
        this._changeBuffer.push({
            ...(commentInfo && {
                changeInfo: commentInfo.newComments.map((n) => {
                    return {
                        ...n,
                        location: (n.location as LocationPlus).serialize(),
                        associatedCode: n.associatedCode
                            ? (n.associatedCode as LocationPlus).serialize()
                            : undefined,
                    };
                }),
            }),
            ...this.getBaseChangeBuffer(),
            typeOfChange: changeEvent.typeOfChange,
            changeContent: addedContent || newContent,
            diff,
            addedBlock,
            removedBlock,
        });
        console.log('change buffer', this._changeBuffer);
        // this._didPaste = false;
    }

    private getBaseChangeBuffer() {
        const time = Date.now();
        return {
            time,
            uid: this.container.firestoreController?._user?.uid || 'anonymous',
            userString: this.container.loggedInUser.githubLogin,
            id: `${this.readableNode.id}:${time}`,
            location: this.readableNode.location.serialize(),
            changeContent: this.readableNode.location.content,
        };
    }

    async handleUpdateNodeMetadata(newContent: string, location: LocationPlus) {
        const editor = window.activeTextEditor || window.visibleTextEditors[0];
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
        this._vscNodeMetadata = newNodeMetadata;
    }

    parentIsContained(location: Location) {
        if (this._tree) {
            const parentContains =
                this._tree.parent?.root?.data.dataController?.isContained(
                    location
                );
            return parentContains;
        }
        return false;
    }

    isContained(location: Location) {
        // console.log('location!', location);
        if (location.uri !== this.readableNode.location.uri) {
            return false;
        }
        return location.range.contains(this.readableNode.location.range);
    }

    handleOnCopy(copyEvent: ClipboardMetadata) {
        if (
            this.isContained(copyEvent.location) &&
            !this.parentIsContained(copyEvent.location)
        ) {
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: this.readableNode.location.content,
                eventData: {
                    [Event.COPY]: {
                        copyContent: copyEvent.text,
                        nodeId: this.readableNode.id,
                    },
                },
            });

            this.container.updateClipboardMetadata({
                code: copyEvent.text,
                id: this.readableNode.id,
                node: this.readableNode.serialize(),
            });
        } else if (this.isOwnerOfRange(copyEvent.location)) {
            this._changeBuffer.push({
                ...this.getBaseChangeBuffer(),
                typeOfChange: TypeOfChange.CONTENT_ONLY,
                changeContent: this.readableNode.location.content,
                eventData: {
                    [Event.COPY]: {
                        copyContent: copyEvent.text,
                        nodeId: this.readableNode.id,
                    },
                },
            });

            this.container.updateClipboardMetadata({
                code: copyEvent.text,
                id: this.readableNode.id,
                node: this.readableNode.serialize(),
            });
        }
    }

    handleOnCommented(commentEvent: {
        location: Location;
        time: number;
        text: string;
    }) {
        const event =
            commentEvent.text.trim()[0] === '/'
                ? Event.COMMENT_OUT
                : Event.COMMENT_IN;
        // if (this.isContained(commentEvent.location)) {
        this._changeBuffer.push({
            ...this.getBaseChangeBuffer(),
            typeOfChange: TypeOfChange.CONTENT_ONLY,
            changeContent: this.readableNode.location.content,
            eventData: {
                [event]: {
                    location: LocationPlus.staticSerialize(
                        commentEvent.location
                    ),
                    time: commentEvent.time,
                },
            },
        });
        console.log('this', this);
        // }
    }

    handleOnPaste(pasteEvent: ClipboardMetadata) {
        setTimeout(() => {
            console.log(
                'PASTED',
                this,
                'paste',
                pasteEvent,
                this.container.copyBuffer
            );
            const doc =
                window.activeTextEditor?.document ||
                window.visibleTextEditors[0].document;
            const location = LocationPlus.fromLocation(pasteEvent.location);
            this.readableNode.location.updateContent(doc);
            // if (!this.readableNode.location.content.includes(pasteEvent.text)) {
            //     await setTimeout(() => {
            //         // feels... hacky!
            //         this.handleOnPaste(pasteEvent);
            //     }, 300);
            //     return;
            // }
            let eventObj: ChangeBuffer | undefined;
            // const eventId: string = `${this.readableNode.id}:paste-${uuidv4()}`;
            const baseChange = this.getBaseChangeBuffer();
            if (this.container.copyBuffer) {
                const { repository, ...rest } = this.container.gitController
                    ?.gitState as CurrentGitState;
                const details = {
                    ...this.container.copyBuffer,
                    location: pasteEvent.location,
                    pasteTime: Date.now(),
                    gitMetadata: rest,
                };
                this._webMetaData.push(details);
                eventObj = {
                    ...this.getBaseChangeBuffer(),
                    // location: this.readableNode.location.serialize(),
                    // location: location.serialize(),

                    typeOfChange: TypeOfChange.CONTENT_ONLY,
                    changeContent: pasteEvent.text,
                    // eventId,
                    eventData: {
                        [Event.WEB]: {
                            copyBuffer: this.container.copyBuffer,
                        },
                    },
                };
                this._changeBuffer.push(eventObj);
                this._debug = true;
                this._emit = true;
                // console.log('posting', this.serialize());
            } else if (this.container._copyVscodeMetadata) {
                // it's kinda goofy that this is separate from the copybuffer -- would be better if they were the same
                const { vscodeMetadata } = pasteEvent;
                // console.log(
                //     'location...',
                //     LocationPlus.fromLocation(pasteEvent.location).updateContent().serialize()
                // );
                eventObj = {
                    ...this.getBaseChangeBuffer(),
                    location: this.readableNode.location.serialize(),
                    typeOfChange: TypeOfChange.CONTENT_ONLY,
                    changeContent: pasteEvent.text,
                    // eventId,
                    eventData: {
                        [Event.PASTE]: {
                            pasteContent: pasteEvent.text,
                            nodeId: this.container._copyVscodeMetadata.id, // replace with readable node id that was copiedd
                            vscodeMetadata: this.container._copyVscodeMetadata,
                        },
                    },
                };
                this._changeBuffer.push(eventObj);
            } else {
                const { vscodeMetadata } = pasteEvent;
                eventObj = {
                    ...this.getBaseChangeBuffer(),
                    location: this.readableNode.location.serialize(),
                    typeOfChange: TypeOfChange.CONTENT_ONLY,
                    changeContent: pasteEvent.text,
                    // eventId,
                    eventData: {
                        [Event.PASTE]: {
                            pasteContent: pasteEvent.text,
                            nodeId: this.readableNode.id, // replace with readable node id that was copiedd
                            vscodeMetadata,
                        },
                    },
                };
                this._changeBuffer.push(eventObj);
            }

            const pasteInfo = {
                location: pasteEvent.location,
                pasteContent: pasteEvent.text,
                pasteMetadata: eventObj,
            };
            this._didPaste = pasteInfo;
            setTimeout(
                () => {
                    const pasteTracker: TrackedPasteDetails = {
                        ...pasteInfo,
                        location: LocationPlus.fromLocation(
                            pasteEvent.location
                        ),
                        originalLocation: {
                            ...LocationPlus.staticSerialize(
                                pasteEvent.location
                            ),
                            content: pasteEvent.text,
                        },
                        currContent: pasteEvent.text,
                        id: baseChange.id,
                        style: getColorTheme(this.container.copyBuffer),
                    };
                    console.log('pasteTracker init', pasteTracker);

                    // setTimeout(
                    //     () =>
                    pasteTracker.location.onChanged.event(
                        (changeEvent: ChangeEvent) => {
                            console.log('changeEvent', changeEvent);
                            pasteTracker.currContent =
                                changeEvent.location.content;
                            console.log('pasteTracker', pasteTracker);
                            // this.handleOnChange(changeEvent)
                        }
                    );
                    this._pasteLocations.push(pasteTracker);
                },
                5000,
                pasteInfo
            );

            if (
                pasteEvent.text.includes('{') &&
                pasteEvent.text.includes('}')
            ) {
                this.handleInsertBlock(
                    pasteEvent.text,
                    pasteEvent.location.range,
                    eventObj
                );

                // return;
            }
        }, 300);
    }

    handleOnChange(changeEvent: ChangeEvent) {
        const location = changeEvent.location;
        const newContent = location.content;
        const oldContent = changeEvent.previousRangeContent.oldContent;

        if (
            !nodeContentChange(
                TypeOfChangeToNodeState(changeEvent.typeOfChange)
            )
        ) {
            return;
        }

        if (this._didPaste) {
            const { location, pasteContent } = this._didPaste;
            const { addedContent, insertedRange } = changeEvent;
            if (
                (insertedRange && location.range.isEqual(insertedRange)) ||
                addedContent === pasteContent
            ) {
                console.log('IN HERE');
                return;
            }
        }

        this.handleUpdateChangeBuffer(oldContent, newContent, changeEvent);
        this.handleUpdateNodeMetadata(newContent, location);
        this.updateWebviewData('recentChanges');
    }

    private isOwnerOfRange(location: Range | Location) {
        const comparator = isLocation(location) ? location.range : location;
        return (
            this._tree &&
            (this._tree.isLeaf ||
                !this._tree.root?.children.some((c) =>
                    c.root?.data.location.range.contains(comparator)
                ))
        );
    }

    private async initGitData() {
        const gitRes = (await this.getGitData()) || [];
        if (gitRes.length > 0) {
            this._gitData = gitRes.map((r) => new TimelineEvent(r));
        } else {
            this._gitData = [];
        }
    }

    private getMinDate() {
        const items = (
            this._gitData || this._changeBuffer.map((c) => new TimelineEvent(c))
        ).concat(this._pastVersions.map((v) => new TimelineEvent(v)));
        if (!items.length) {
            return Date.now();
        }
        return items.reduce((min, p) =>
            p._formattedData.x < min._formattedData.x ? p : min
        );
    }

    joinOnCommits(ts: TimelineEvent[]) {
        const prMap: Map<number, string[]> = new Map();
        const objMap: Map<number, Map<string, TimelineEvent[]>> = new Map();
        const objMap2: Map<number, { [k: string]: TimelineEvent[] }> =
            new Map();
        ts.forEach((t) => {
            const { commit } = t._formattedData;
            // console.log('commit', commit, 't', t);
            if (commit) {
                const pr = t._formattedData.pullNumber || 0;
                // if (pr) {
                const prs = prMap.get(pr);
                const obj = objMap.get(pr);
                const obj2 = objMap2.get(pr);

                if (obj2) {
                    const tt = obj2[commit];
                    obj2[commit] = tt ? [...tt, t] : [t];
                } else {
                    objMap2.set(pr, { [commit]: [t] });
                }

                if (obj) {
                    const tt = obj.get(commit);

                    obj.set(commit, tt ? [...tt, t] : [t]);
                } else {
                    objMap.set(pr, new Map());
                    objMap.get(pr)!.set(commit, [t]);
                }

                if (prs) {
                    prMap.set(pr, [...prs, commit]);
                    // const innerMap = obj.get(pr);
                    // objMap.set(pr, obj?.set(commit, t) || new Map());
                } else {
                    prMap.set(pr, [commit]);
                }
                // } else {
                //     prMap.set(
                //         0,
                //         prMap.get(0)
                //             ? [...(prMap.get(0) as string[]), commit]
                //             : [commit]
                //     );

                //     // objMap.set(0, objMap.get(0) ?  || new Map());
                // }
            }
        });
        // console.log('obj...', objMap, 'obj2', objMap2);
        return objMap2;
    }

    async handleOnSelected(location: Selection) {
        if (this.isOwnerOfRange(location)) {
            // const allData = this.serialize();
            if (!this._gitData?.length && !this._new) {
                await this.updateWebviewData('gitData');
            }
            console.log('sending this', this.formatWebviewData(), this);
            this.container.webviewController?.postMessage({
                command: 'updateTimeline',
                data: {
                    id: this.readableNode.id,
                    // metadata: this._webviewData,
                    metadata: this.formatWebviewData(),
                },
            });
            this.container.activeNode = this;
        }
    }

    joinEvents(es: TimelineEvent[]) {
        const masterEventObject: { [k in Event]?: any } = {};
        es.forEach((e) => {
            const source = e.originalData as SerializedChangeBuffer;
            const key = source.eventData && Object.keys(source.eventData);
            key?.forEach((k) => {
                if (masterEventObject[k as Event]) {
                    masterEventObject[k as Event].push(e);
                } else {
                    masterEventObject[k as Event] = [e];
                }
            });
            // const val = e[key];
        });
        return masterEventObject;
    }

    isInteresting(change: ChangeBuffer): boolean {
        if (change.eventData) {
            return true;
        }
        return false;
    }

    formatWebviewData(): WebviewData {
        const allData = this.serialize();
        const pastVersions = this._pastVersions.map(
            (v) => new TimelineEvent(v)
        );
        const changeBuffer = this._changeBuffer
            .filter((c) => this.isInteresting(c))
            .map((c) => new TimelineEvent(c));
        const meta = pastVersions.concat(changeBuffer);
        const items = meta.concat(this._gitData || []).sort((a, b) => {
            const aDate = a._formattedData.x;
            const bDate = b._formattedData.x;
            return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
        });
        const events = this.joinEvents(meta);
        return {
            ...allData,
            pastVersions: this._pastVersions,
            formattedPastVersions: pastVersions,
            gitData: this._gitData || [],
            items,
            firstInstance: items[0],
            parent: this._tree?.parent?.root?.data.dataController?.serialize(),
            children: this._tree?.root?.children.map((c) =>
                c.root?.data.dataController?.serialize()
            ),
            events: meta
                .filter(
                    (v) => (v.originalData as SerializedChangeBuffer).eventData
                )
                .map((v) => (v.originalData as ChangeBuffer).eventData),
            eventsMap: events,
            recentChanges: changeBuffer,
            userMap: this.container.loggedInUser,
            prMap: Object.fromEntries(this.joinOnCommits(items)),
            displayName: this._displayName,
            pasteLocations: this._pasteLocations.map((p) => {
                return { ...p, location: p.location.serialize() };
            }),
        };
    }

    evenSimplerTraverse(
        sourceFile: ts.SourceFile,
        docCopy: TextDocument,
        changeBuffer?: ChangeBuffer
    ) {
        const nodes: ts.Node[] = [];
        // const blocks: { [k: string]: any }[] = [];
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [this._tree!];
        const code = docCopy.getText();
        const context = this;
        const bigLocation = new LocationPlus(
            docCopy.uri,
            new Range(0, 0, docCopy.lineCount, 1000),
            { doc: docCopy }
        );
        console.log('bigLocation', bigLocation);
        bigLocation.updateContent(docCopy);
        function enter(node: ts.Node) {
            nodes.push(node);
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) => n);
                let name = `${getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                )}:${uuidv4()}`;
                const offsetStart = code.indexOf(node.getText());
                if (offsetStart === -1) {
                    console.error('not ready');
                    return;
                }
                console.log(
                    'offsetStart',
                    offsetStart,
                    'node text',
                    node.getText()
                );
                const offsetEnd = offsetStart + node.getText().length;
                console.log('end', offsetEnd);
                const newLocation = new LocationPlus(
                    docCopy.uri,
                    bigLocation.deriveRangeFromOffset(offsetStart, offsetEnd),
                    { doc: docCopy }
                );
                console.log('newLocation', newLocation);
                newLocation.updateContent(docCopy);
                const readableNode = context.initReadableNode(
                    ReadableNode.create(
                        node,
                        newLocation,
                        context.container,
                        name
                    ),
                    name
                );
                console.log('made this', readableNode);
                const treeRef = currTreeInstance[
                    currTreeInstance.length - 1
                ].insert(readableNode, {
                    name: name,
                });
                readableNode.dataController?.setTree(treeRef);
                readableNode.dataController!._new = true;
                changeBuffer &&
                    readableNode.dataController?._changeBuffer.push(
                        changeBuffer
                    );
                currTreeInstance.push(treeRef);
                // todo: add position using node offset within inserted range because
                // inserted ranges can be a bit wonky
                // blocks.push({ node, name: `${name}` });
            }
        }

        function leave(node: ts.Node) {
            const topNode = nodes.pop();
            if (topNode && ts.isBlock(node)) {
                currTreeInstance.pop();
            }
        }

        tstraverse.traverse(sourceFile, { enter, leave });
        console.log('jesus christ', this);
        // return blocks;
    }

    async handleOnSaveTextDocument(textDocument: TextDocument) {
        // console.log('posting', this.serialize());
        // if nothing has changed, don't do anything
        // note change buffer wont update if the content is the same
        // but range is different, may be worth updating db in that case but
        // doing none of these other things
        if (!this._changeBuffer.length) {
            return;
        }

        // if the node has been deleted, notify the parent up until the parent no longer has the
        // status of deleted and update db

        if (
            this.readableNode.state &&
            this.readableNode.state === NodeState.DELETED
        ) {
            this._tree?.parent?.remove(this.readableNode);
        }

        console.log('this....', this);

        this._firestoreControllerInterface?.write({
            ...this.serialize(),
        });
        if (this.container.gitController?.gitState) {
            const { commit, branch } = this.container.gitController
                ?.gitState as CurrentGitState;
            const lastEdit = this._changeBuffer[this._changeBuffer.length - 1];
            [
                ...this._changeBuffer.filter((c) => this.isInteresting(c)),
                lastEdit,
            ].forEach((c) => {
                const { diff, ...rest } = c;
                const obj = {
                    ...rest,
                    commit, // tbd if we just want this as a subcollection
                    branch,
                };
                this._pastVersions.push({
                    ...obj,
                    node: this.readableNode.serialize(),
                });
                this._firestoreControllerInterface?.logVersion(c.id, obj);
            });
            this._changeBuffer = [];
        }
    }

    async handleOnDidChangeActiveTextEditor(
        textDocument: TextDocument | undefined
    ) {
        if (
            textDocument?.uri.fsPath ===
                this.readableNode.location.uri.fsPath &&
            !this._seen
        ) {
            // console.log('opening', this);
            this._seen = true;
            this._pastVersions =
                (await this._firestoreControllerInterface?.readPastVersions()) ||
                [];
            // console.log('this', this);
        }
    }

    async updateWebviewData(field: string) {
        const getItems = () => {
            const pastVersions = this._pastVersions.map(
                (v) => new TimelineEvent(v)
            );
            const changeBuffer = this._changeBuffer.map(
                (c) => new TimelineEvent(c)
            );
            const meta = pastVersions.concat(changeBuffer);
            const items = meta.concat(this._gitData || []);
            return { items, changeBuffer, pastVersions, meta };
        };

        if (!this._webviewData) {
            return this.formatWebviewData();
        }

        switch (field) {
            case 'gitData': {
                await this.initGitData();
                const { items, changeBuffer, pastVersions, meta } = getItems();
                const prMap = Object.fromEntries(this.joinOnCommits(items));
                this._webviewData = {
                    ...this._webviewData,
                    pastVersions: this._pastVersions,
                    formattedPastVersions: pastVersions,
                    items,
                    recentChanges: changeBuffer,
                    events: meta
                        .filter(
                            (v) =>
                                (v.originalData as SerializedChangeBuffer)
                                    .eventData
                        )
                        .map((v) => (v.originalData as ChangeBuffer).eventData),
                    gitData: this._gitData || [],
                    prMap,
                };
            }
            case 'firestoreData': {
                const { items, changeBuffer, pastVersions, meta } = getItems();
                this._webviewData = {
                    ...this._webviewData,
                    pastVersions: this._pastVersions,
                    formattedPastVersions: pastVersions,
                    items,
                    recentChanges: changeBuffer,
                    events: meta
                        .filter(
                            (v) =>
                                (v.originalData as SerializedChangeBuffer)
                                    .eventData
                        )
                        .map((v) => (v.originalData as ChangeBuffer).eventData),
                };
            }
            case 'recentChanges': {
                const { items, changeBuffer, meta } = getItems();
                this._webviewData = {
                    ...this._webviewData,
                    items,
                    recentChanges: changeBuffer,
                    events: meta
                        .filter(
                            (v) =>
                                (v.originalData as SerializedChangeBuffer)
                                    .eventData
                        )
                        .map((v) => (v.originalData as ChangeBuffer).eventData),
                };
            }
            default:
                this._webviewData = this.formatWebviewData();
        }
    }

    getGitData() {
        try {
            const res = this.container.gitController?.gitLog(
                this.readableNode.location
            );
            return res;
        } catch (e) {
            return [];
        }
    }

    async getFirestoreData() {
        return await this.container.firestoreController?.query(
            this.readableNode.id
        );
    }

    // serialize(): SerializedDataController {
    serialize(): SerializedNodeDataController {
        return {
            node: this.readableNode.serialize(),
            lastUpdatedTime: Date.now(),
            lastUpdatedBy:
                this.container.firestoreController?._user?.uid || 'anonymous',
            setOfEventIds: [],
            pasteLocations: this._pasteLocations.map((p) => {
                return { ...p, location: p.location.serialize() };
            }),
        };
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

    get webMetaData() {
        return this._webMetaData;
    }

    set tree(newTree: SimplifiedTree<ReadableNode> | undefined) {
        this._tree = newTree;
    }

    get tree() {
        return this._tree;
    }

    get firestoreControllerInterface() {
        return this._firestoreControllerInterface;
    }

    set firestoreControllerInterface(newFirestoreControllerInterface) {
        this._firestoreControllerInterface = newFirestoreControllerInterface;
    }
}
