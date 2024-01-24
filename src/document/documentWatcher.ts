import {
    Disposable,
    TextDocument,
    // TextDocumentChangeEvent,
    workspace,
    window,
    Range,
    TextEditorSelectionChangeEvent,
    TextDocumentContentChangeEvent,
    TextDocumentChangeEvent,
    commands,
    TextEditor,
} from 'vscode';
import { Container } from '../container';
import {
    // filterOutliers,
    getProjectName,
    getVisiblePath,
    makeReadableNode,
    // quantile,
} from './lib';
import {
    SimplifiedTree,
    SummaryStatus,
    getSimplifiedTreeName,
} from '../tree/tree';
import * as ts from 'typescript';
// import { ReadableNode, isReadableNode } from '../constants/types';
import ReadableNode, { NodeState } from '../tree/node';
import LocationPlus from './locationApi/location';
import { FileParsedEvent } from '../fs/FileSystemController';
import {
    DataController,
    FirestoreControllerInterface,
} from '../data/DataController';
import { v4 as uuidv4 } from 'uuid';
// import { VscodeTsNodeMetadata } from './languageServiceProvider/LanguageServiceProvider';
import RangePlus from './locationApi/range';
import { isEmpty } from 'lodash';
import { SerializedReadableNode } from '../constants/types';
import TimelineEvent from '../data/timeline/TimelineEvent';
// import { debounce } from '../lib';
const tstraverse = require('tstraverse');

class DocumentWatcher extends Disposable {
    _disposable: Disposable | undefined;
    readonly _relativeFilePath: string;
    private _firestoreCollectionPath: string;
    _nodesInFile: SimplifiedTree<ReadableNode> | undefined;
    _writeWholeFile: boolean = false;
    isDirty: boolean = false;
    constructor(
        readonly document: TextDocument,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._relativeFilePath = getVisiblePath(
            workspace.name || getProjectName(this.document.uri.toString()),
            this.document.uri.fsPath,
            this.container.context.extensionUri
        ).replace(/\\/g, '/');
        // const commandDisposable = commands.registerCommand(
        //     'meta-manager.indexFile',
        //     () => {
        // this._nodesInFile = this.initNodes();
        //     }
        // );
        this._firestoreCollectionPath = '';

        this._nodesInFile = undefined;
        const otherListener = container.onNodesComplete(() => {});

        const firestoreReadListener = container.onRead(
            (event: FileParsedEvent) => {
                // console.log('EVENT', event);
                const { filename, data, map, collectionPath } = event;

                if (filename === this._relativeFilePath) {
                    console.log('HEWWWWOOOO!!!!!!!!!', event);
                    this._firestoreCollectionPath = collectionPath;
                    // fudge for new files
                    if (!data) {
                        this._nodesInFile = this.initNodes();
                    } else {
                        const tree = new SimplifiedTree<ReadableNode>({
                            name: this._relativeFilePath,
                        }).deserialize(
                            data,
                            new ReadableNode(
                                '',
                                new LocationPlus(
                                    this.document.uri,
                                    new Range(0, 0, 0, 0)
                                )
                            ),
                            this._relativeFilePath
                        );
                        console.log('tree', tree);
                        this._nodesInFile = this.initNodes(tree, map, data);
                        console.log('nodes in file', this._nodesInFile);
                    }

                    console.log(
                        'file parsed complete for ' + this._relativeFilePath,
                        this
                    );
                }
            }
        );

        const reindexListener = this.container.reindexFileEmitter((event) => {
            if (event.document === this.document) {
                this._nodesInFile = this.traverse(
                    this._nodesInFile,
                    undefined,
                    undefined,
                    true
                );
            }
        });

        const indexBlockListener = this.container.indexBlockEmitter((event) => {
            console.log(
                'owned?',
                !this._nodesInFile
                    ?.toArray()
                    .filter((t) => t.humanReadableKind !== 'file')
                    .some((s) => s.location.range.contains(event.selection)),
                event.selection,
                'nodes',
                this._nodesInFile
            );
            if (
                this.document.uri.fsPath ===
                    window.activeTextEditor?.document.uri.fsPath &&
                !this._nodesInFile
                    ?.toArray()
                    .filter((t) => t.humanReadableKind !== 'file')
                    .some((s) => s.location.range.contains(event.selection))
            ) {
                console.log('nodes before', this._nodesInFile);
                this._nodesInFile = this.traverse(
                    this._nodesInFile,
                    undefined,
                    undefined,
                    true
                );
                console.log('node after', this._nodesInFile);
                const arr = this._nodesInFile?.toArray();
                const nodeToUpdate = arr.find((n) => {
                    return n.location.range.contains(event.selection);
                });
                if (nodeToUpdate) {
                    const thisNode = arr.find(
                        (p) => p.humanReadableKind === 'file'
                    );
                    if (thisNode) {
                        nodeToUpdate.dataController!._changeBuffer =
                            thisNode._dataController?._changeBuffer || [];
                    }
                }
            }
        });

        const saveListener = workspace.onDidSaveTextDocument((e) =>
            this.handleOnDidSaveDidClose(e)
        );
        // window, active, if, arrowFunction
        // 1626297163796, [0, 60], [22, 33] [20, 45]

        const activeListener = window.onDidChangeActiveTextEditor((e) =>
            this.handleWindowChange(e)
        );
        const listeners = [
            saveListener,
            // listener,
            otherListener,
            firestoreReadListener,
            reindexListener,
            activeListener,
            indexBlockListener,
            // commandDisposable,
            // docChangeListener,
        ].filter((d) => d) as Disposable[];
        this._disposable = Disposable.from(...listeners);
    }

    handleWindowChange(e: TextEditor | undefined) {
        if (e?.document.uri.fsPath !== this.document.uri.fsPath) {
            return;
        }
        console.log('nodes', this._nodesInFile, this);
        const nodesArray = this._nodesInFile
            ?.toArray()
            .filter((d) => d.humanReadableKind !== 'file');
        console.log('nodesArray', nodesArray);
        let keyMap: { [k: string]: any[] } = {};
        let key2Map: { [k: string]: any } = {};
        const keys = nodesArray!.map((i) => {
            keyMap = { ...keyMap, [i.id]: [] };
            key2Map = { ...key2Map, [i.id]: [] };
            return i.id;
        });
        // temp hack because for some reason pastVersions isn't populated on load?
        // I'm not sure why this is as everything else is...?
        setTimeout(() => {
            // console.log(n._dataController?._pastVersions);

            console.log('hewwo?', key2Map);
            const windowed = [];
            const past: any[] = nodesArray!
                .map((n) =>
                    // n.dataController?._pastVersionsTest.flatMap((p) => {
                    {
                        const { _pastVersions, ...rest } =
                            n.dataController || {};
                        console.log(
                            'n',
                            n,
                            'n.data',
                            n.dataController,
                            'im so conffused',
                            n._dataController?._pastVersions,
                            'copy?',
                            _pastVersions,
                            'rest',
                            rest,
                            '???????????????',
                            n._dataController?.getPastVersions()
                        );

                        return n.dataController?._pastVersions.flatMap((p) => {
                            console.log('p!', p);
                            const item = {
                                ...p,
                                currNode: n.serialize(),
                                ...(n.dataController?._pasteLocations.some(
                                    (pa) => pa.id === p.id
                                ) && {
                                    paste: n.dataController?._pasteLocations.find(
                                        (pa) => pa.id === p.id
                                    ),
                                }),
                                timelineEvent: new TimelineEvent(p),
                                treeParent:
                                    n.dataController?.tree?.parent?.name || '',
                                depth: n.dataController?.tree?.depth || 0,
                                allPasteLocations:
                                    n.dataController?._pasteLocations,
                            };
                            console.log('item', item);
                            return item;
                        });
                    }
                )
                .flat();
            console.log('past', past);
            const lol = past
                // .sort((a, b) => (a?.time || -1) - (b?.time || -1))
                .sort(
                    (a, b) =>
                        parseInt(a?.id.split(':')[2]) -
                        parseInt(b?.id.split(':')[2])
                )
                .map((n, i) => {
                    const key = keys?.find((k) => n?.id.includes(k)) || '';
                    return {
                        ...n,
                        [key]: [
                            n?.location.range.start.line,
                            n?.location.range.end.line,
                        ],
                        parentId: key,
                        editTimeDiff: Math.abs(
                            n!.time - (past[i - 1]?.time || n!.time)
                        ),
                    };
                });
            console.log('lol......', lol);

            let km1 = {};
            keys.forEach((k) => {
                km1 = { ...km1, [k]: [] };
            });
            const chunkyChunk: any[] = [km1];
            console.log('km1!', km1);
            let newThing = true;
            let knownKey: string = '';
            let otherInfo: { [k: string]: any } = {
                global: {
                    filename: this.relativeFilePath,
                    commits: [],
                    user: lol[0]?.userString || 'unknown',
                },
            };
            let scale = {
                xMin: 0,
                xMax: 0,
                yMin: 0,
                yMax: 0,
                otherInfo,
            };
            const seenKeys = new Set();
            const seenCommits = new Set();
            lol.forEach((n, i) => {
                // if (!knownKey.length) {

                knownKey = n.parentId;
                // }
                // combine chunking approach with clustering approach
                // on each new chunk, copy over last known values for each key
                // each key starts with default value of 0 start 0 end, and time of current n

                // I guess we can have every chunk get updated, even if it isn't appearing in n
                // such that the lists stay in sync -- hence copying over last known n value

                // update key as it appears in chunk
                // then switch to new chunk when enough time has passed
                const lastEntry = chunkyChunk[chunkyChunk.length - 1]; // n.editTimeDiff >= 28800000 ||
                if (newThing) {
                    newThing = false;
                    // console.log(
                    //     'huh?',
                    //     lastEntry[n.parentId][0]?.x[
                    //         lastEntry[n.parentId][0]?.length - 1
                    //     ],
                    //     'last',
                    //     lastEntry
                    // );
                    // scale.xMax =
                    //     lastEntry[n.parentId][0]?.x[
                    //         lastEntry[n.parentId][0]?.length - 1
                    //     ] || 0;
                    lastEntry['scale'] = {
                        ...scale,
                        length: lastEntry[n.parentId][0]?.x.length || 0,
                    };
                    let newEntry = lastEntry;
                    scale.xMin = n.time || 0;
                    // lastEntry.scale.xMax =
                    //     lastEntry[n.parentId][0]?.x[
                    //         lastEntry[n.parentId][0]?.length - 1
                    //     ] || 0;
                    Object.keys(lastEntry)
                        .filter((k) => k !== 'scale')
                        .forEach((k) => {
                            // console.log('k', k);
                            let idx = i - lastEntry?.scale.length || 0;
                            if (!seenCommits.has(n.commit)) {
                                seenCommits.add(n.commit);
                                scale.otherInfo.commits
                                    ? scale.otherInfo.global.commits.push({
                                          commit: n.commit,
                                          idx,
                                      })
                                    : (scale.otherInfo.global.commits = [
                                          {
                                              commit: n.commit,
                                              idx,
                                          },
                                      ]);
                            }
                            if (k === n.parentId) {
                                if (!seenKeys.has(k)) {
                                    scale.otherInfo[k] = {
                                        firstSeen: {
                                            ...n,
                                            idx,
                                        },
                                        count: 0,
                                    };
                                    seenKeys.add(k);
                                }
                                scale.otherInfo[k].count++;
                                scale.yMax =
                                    (n.location!.range.end.line || 0) >
                                    scale.yMax
                                        ? n.location!.range.end.line
                                        : scale.yMax;
                                scale.yMin =
                                    (n.location!.range.start.line || 0) <
                                    scale.yMin
                                        ? n.location!.range.start.line
                                        : scale.yMin;
                                if (n['eventData']) {
                                    // scale.otherInfo.globalEvents
                                    scale.otherInfo[k].events
                                        ? scale.otherInfo[k].events.push({
                                              ...n,
                                              time: n.time,
                                              idx,
                                          })
                                        : (scale.otherInfo[k].events = [
                                              {
                                                  ...n,
                                                  time: n.time,
                                                  idx,
                                              },
                                          ]);
                                }
                                if (n['eventData']) {
                                    n = {
                                        ...n,
                                        idx,
                                    };
                                }
                                newEntry = {
                                    ...newEntry,
                                    [k]: [
                                        {
                                            x: [n.time],
                                            y: [n.location?.range.end.line],
                                            data: [{ ...n, inEdit: true, idx }],
                                        },
                                        {
                                            x: [n.time],
                                            y: [n.location?.range.start.line],
                                            data: [{ ...n, inEdit: true, idx }],
                                            events: n['eventData']
                                                ? [
                                                      {
                                                          ...n,
                                                          time: n.time,
                                                          idx,
                                                      },
                                                  ]
                                                : [],
                                        },
                                    ],
                                };
                                // console.log('new entry after', newEntry);
                            } else {
                                // console.log('in else');

                                newEntry = {
                                    ...newEntry,
                                    [k]: [
                                        {
                                            x: [n.time],
                                            y: [
                                                lastEntry[k][0]?.y[
                                                    lastEntry[k][0]?.y.length -
                                                        1
                                                ] || 0,
                                            ],
                                            data: [
                                                {
                                                    ...lastEntry[k][0]?.data[
                                                        lastEntry[k][0]
                                                            ?.length - 1
                                                    ],
                                                    idx,
                                                } || null,
                                            ],
                                        },
                                        {
                                            x: [n.time],
                                            y: [
                                                lastEntry[k][1]?.y[
                                                    lastEntry[k][1]?.y.length -
                                                        1
                                                ] || 0,
                                            ],
                                            data: [
                                                {
                                                    ...lastEntry[k][0]?.data[
                                                        lastEntry[k][0]
                                                            ?.length - 1
                                                    ],
                                                    idx,
                                                } || null,
                                            ],
                                            events: [],
                                        },
                                    ],
                                };
                                // console.log('else new entry', newEntry);
                            }
                            // console.log('huh?', newEntry);
                            // return { ...newEntry, [k]: lastEntry[k] };
                        });
                    chunkyChunk.push(newEntry);
                    // chunkyChunk.push({

                    // })
                    // chunkyChunk.push([
                    //     {
                    //         x: [n.time],
                    //         y: [n.location?.range.end.line],
                    //         data: [n],
                    //     },
                    //     {
                    //         x: [n.time],
                    //         y: [n.location?.range.start.line],
                    //         data: [n],
                    //     },
                    // ]);
                } else {
                    Object.keys(lastEntry)
                        .filter((k) => k !== 'scale')
                        .forEach((k) => {
                            let idx = i - lastEntry?.scale.length || 0;
                            const startLinesByTime = lastEntry[k][1];
                            const endLinesByTime = lastEntry[k][0];
                            if (!seenKeys.has(k)) {
                                scale.otherInfo[k] = {
                                    firstSeen: {
                                        ...n,
                                        idx,
                                    },
                                    count: 0,
                                };
                                seenKeys.add(k);
                            }
                            if (!seenCommits.has(n.commit)) {
                                seenCommits.add(n.commit);
                                scale.otherInfo.global.commits
                                    ? scale.otherInfo.global.commits.push({
                                          commit: n.commit,
                                          idx: i - lastEntry?.scale.length || 0,
                                      })
                                    : (scale.otherInfo.global.commits = [
                                          {
                                              commit: n.commit,
                                              idx,
                                          },
                                      ]);
                            }
                            n.parentId === k && scale.otherInfo[k].count++;
                            startLinesByTime.x.push(n.time);
                            scale.yMax =
                                (n.location!.range.end.line || 0) > scale.yMax
                                    ? n.location!.range.end.line
                                    : scale.yMax;
                            scale.yMin =
                                (n.location!.range.start.line || 0) < scale.yMin
                                    ? n.location!.range.start.line
                                    : scale.yMin;
                            startLinesByTime.y.push(
                                k === n.parentId
                                    ? n.location?.range.start.line
                                    : lastEntry[k][1].y[
                                          lastEntry[k][1].y.length - 1
                                      ]
                            );
                            if (k === n.parentId) {
                                n = {
                                    ...n,
                                    idx,
                                    inEdit: true,
                                    // eventData: {
                                    //     ...n.eventData,

                                    // },
                                };
                                !n['eventData'] &&
                                    startLinesByTime.data.push({ ...n, idx });
                                if (n['eventData']) {
                                    // if (n['eventData']) {

                                    startLinesByTime.data.push({ ...n, idx });
                                    // }
                                    startLinesByTime.events.push({
                                        ...n,
                                        time: n.time,
                                        idx: i - lastEntry.scale.length,
                                    });
                                    scale.otherInfo[k].events
                                        ? scale.otherInfo[k].events.push({
                                              ...n,
                                              time: n.time,
                                              idx: i - lastEntry.scale.length,
                                          })
                                        : (scale.otherInfo[k].events = [
                                              {
                                                  ...n,
                                                  time: n.time,
                                                  idx:
                                                      i -
                                                      lastEntry.scale.length,
                                              },
                                          ]);
                                }
                            } else {
                                const lastDataEntry =
                                    lastEntry[k][1].data[
                                        lastEntry[k][1].data.length - 1
                                    ];
                                if (lastDataEntry.eventData) {
                                    const { eventData, ...rest } =
                                        lastDataEntry;
                                    startLinesByTime.data.push({
                                        ...rest,
                                        idx,
                                    });
                                } else {
                                    startLinesByTime.data.push({
                                        ...lastEntry[k][1].data[
                                            lastEntry[k][1].data.length - 1
                                        ],
                                        idx,
                                    });
                                }
                            }
                            endLinesByTime.x.push(n.time);
                            endLinesByTime.y.push(
                                k === n.parentId
                                    ? n.location?.range.end.line
                                    : lastEntry[k][0].y[
                                          lastEntry[k][0].y.length - 1
                                      ]
                            );

                            // return { ...newEntry, [k]: lastEntry[k] };
                        });

                    // const startLinesByTime =
                    //     chunkyChunk[chunkyChunk.length - 1][1];
                    // const endLinesByTime =
                    //     chunkyChunk[chunkyChunk.length - 1][0];

                    // startLinesByTime.x.push(n.time);
                    // startLinesByTime.y.push(n.location?.range.start.line);
                    // startLinesByTime.data.push(n);
                    // endLinesByTime.x.push(n.time);
                    // endLinesByTime.y.push(n.location?.range.end.line);
                    // chunkyChunk[chunkyChunk.length - 1][2].push(n);
                }
                scale.xMax = n.time || 0;
                if (n.parentId) {
                    const entry = keyMap[n.parentId];
                    const entry2 = key2Map[n.parentId];
                    // console.log('wuhwoh', entry2, 'chunks', chunks, 'n', n);
                    if (n.editTimeDiff >= 28800000 || !entry2.length) {
                        entry2.push([
                            {
                                x: [n.time],
                                y: [n.location?.range.end.line],
                            },
                            {
                                x: [n.time],
                                y: [n.location?.range.start.line],
                            },
                        ]);
                    } else {
                        const startLinesByTime = entry2[entry2.length - 1][1];
                        // console.log('2d array skull', startLinesByTime);
                        const endLinesByTime = entry2[entry2.length - 1][0];
                        // console.log('2d array skull', endLinesByTime);
                        startLinesByTime.x.push(n.time);
                        startLinesByTime.y.push(n.location?.range.start.line);
                        endLinesByTime.x.push(n.time);
                        endLinesByTime.y.push(n.location?.range.end.line);
                        // console.log(
                        //     'start end',
                        //     startLinesByTime,
                        //     endLinesByTime
                        // );
                    }
                    if (entry.length) {
                        const startLinesByTime = entry[1];
                        const endLinesByTime = entry[0];
                        startLinesByTime.x.push(n.time);
                        startLinesByTime.y.push(n.location?.range.start.line);
                        endLinesByTime.x.push(n.time);
                        endLinesByTime.y.push(n.location?.range.end.line);
                    } else {
                        entry.push({
                            x: [n.time],
                            y: [n.location?.range.end.line],
                        });
                        entry.push({
                            x: [n.time],
                            y: [n.location?.range.start.line],
                        });
                    }
                }
            });
            const entry = chunkyChunk[chunkyChunk.length - 1][knownKey];
            console.log('huh', entry, 'c', chunkyChunk);
            chunkyChunk[chunkyChunk.length - 1]['scale'] = {
                ...scale,
                length: entry ? entry[0]?.x.length : 0,
            };
            chunkyChunk.shift();
            console.log(
                'what is she cooking',
                key2Map,
                'im going insane',
                chunkyChunk
            );
            const windowLength = 20;
            for (let i = 0; i < (lol.length || 0); i += windowLength) {
                const currWindow = lol.slice(i, i + windowLength);
                // windowed.push();
                let keyObj: { [k: string]: any } = {};
                let windowMax = -Infinity;
                let windowMin = Infinity;

                keys?.forEach((k) => {
                    keyObj[k] = currWindow
                        .filter((n) => n.parentId === k)
                        .reduce(
                            // consider capturing specific start and end time + line range to then translate/bezier curve across
                            // in vis
                            (acc, curr, i) => {
                                const update = {
                                    start: Math.min(
                                        acc.start,
                                        curr.location?.range.start.line || 0
                                    ),
                                    end: Math.max(
                                        acc.end,
                                        curr.location?.range.end.line || 0
                                    ),
                                };
                                if (update.start < windowMin)
                                    windowMin = update.start;
                                if (update.end > windowMax)
                                    windowMax = update.end;
                                return update;
                            },
                            { start: Infinity, end: -Infinity }
                        );
                });
                const window = {
                    start: currWindow?.[0]?.time,
                    end: currWindow?.[currWindow.length - 1]?.time,
                    windowMax,
                    windowMin,
                    ...keyObj,
                };
                windowed.push(window);
            }
            console.log('lol!', windowed, this.container.webviewController);
            lol?.length &&
                this.container.webviewController?.postMessage({
                    command: 'updateTimeline',
                    data: {
                        metadata: lol,
                        keys,
                        windowed,
                        chunkyChunk,
                    },
                });
        }, 3000);
    }

    get relativeFilePath() {
        return this._relativeFilePath;
    }

    get nodesInFile() {
        return this._nodesInFile;
    }

    handleOnDidSaveDidClose(event: TextDocument) {
        if (event.uri.fsPath === this.document.uri.fsPath) {
            // this.container.firestoreController?.write();
            // this.container.firestoreController?.writeFile(
            //     this.initSerialize(),
            //     this._firestoreCollectionPath
            // );
            // this._writeWholeFile = false;
            // console.log('before traverse', this._nodesInFile);
            // this._nodesInFile = this.traverse(this._nodesInFile);
            // console.log('after traverse', this._nodesInFile);
        }
    }

    initNewFile() {
        console.log('new project', this);
        if (this._nodesInFile === undefined) {
            // console.log('hewwo????', this);
            this._nodesInFile = this.initNodes();
            // console.log('NEW NODES', this._nodesInFile);
        }
    }

    initSerialize() {
        return (
            this._nodesInFile?.serialize().map((n) => {
                return {
                    node: n as unknown as SerializedReadableNode, // bad
                    changeBuffer: [],
                    webMetadata: [],
                };
            }) || []
        );
    }

    initNodes(
        oldTree?: SimplifiedTree<ReadableNode>,
        map?: Map<string, any>,
        data?: any[]
    ) {
        const tree = this.traverse(oldTree, map, data);
        return tree;
    }

    // updateTree(oldTree: SimplifiedTree<ReadableNode>) {
    //     const copy = oldTree.toArray()

    // }

    traverse(
        oldTree?: SimplifiedTree<ReadableNode>,
        map?: Map<string, FirestoreControllerInterface>,
        data?: any[],
        copy = false
    ) {
        // traverse the document and find the code anchors
        const sourceFile = ts.createSourceFile(
            this.document.fileName,
            this.document.getText(),
            ts.ScriptTarget.Latest,
            true
        );
        let debug = false;
        let nodes: ts.Node[] = [];
        const docCopy = this.document;
        const tree = new SimplifiedTree<ReadableNode>({
            name: this._relativeFilePath,
        });
        console.log('tree in trav first', tree);
        const fileData = new ReadableNode(
            'file',
            new LocationPlus(
                this.document.uri,
                new Range(0, 0, docCopy.lineCount, 1000),
                { doc: docCopy }
            )
        );
        console.log('fileData in trav first', fileData);
        fileData.setId(this._relativeFilePath.replace('/', '-'));
        console.log('fileData in id', fileData);
        fileData.location.updateContent(docCopy);
        console.log('fileData content', fileData);
        fileData.dataController = new DataController(
            fileData,
            this.container,
            true
        );
        console.log('fileData data', fileData);
        fileData.dataController._tree = tree;
        console.log('fileData data tree', fileData);
        fileData.registerListeners();
        console.log('file data', fileData);
        tree.initRoot(fileData); // initialize the root node
        // const fileLevelNode = new ReadableNode(
        //     'file',
        //     new LocationPlus(
        //         this.document.uri,
        //         new Range(0, 0, docCopy.lineCount, 1000)
        //     )
        // );
        console.log('tree in trav', tree);
        // tree.insert(fileLevelNode, { name: this._relativeFilePath });
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [tree];
        const context = this;
        let otherTreeInstance: SimplifiedTree<ReadableNode> | undefined =
            oldTree;
        const crazyIdeaMap = new Map<string, ReadableNode>();
        const seenNodes = new Set<string>();
        // Enter function will be executed as each node is first interacted with
        console.log('oldTree', oldTree);
        let knownNodes = [...(oldTree?.toArray() || [])];
        function enter(node: ts.Node) {
            nodes.push(node);

            // probably need to add in other scopes such as object literals
            // some of the scopes do not use the block node
            // i'm not sure why
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) => n);
                let name = `${getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                )}`;
                let readableNode = // context.initNode(
                    // new DataController(
                    ReadableNode.create(node, docCopy, context.container, name);

                readableNode.dataController = new DataController(
                    readableNode,
                    context.container
                    // debug
                );
                let newNode = false;
                readableNode.location.updateContent(docCopy);
                // we have a point of comparison

                if (otherTreeInstance && oldTree) {
                    const matchInfo = context.match(
                        otherTreeInstance,
                        oldTree,
                        readableNode,
                        name,
                        name.includes('Google')
                    );
                    if (!matchInfo.name.includes(name)) {
                        readableNode.dataController.setDisplayName(name);
                    }
                    name = matchInfo.name;
                    seenNodes.add(name);
                    otherTreeInstance = matchInfo.otherTreeInstance;
                    newNode = matchInfo.new || false;
                    if (copy) {
                        readableNode.dataController =
                            (matchInfo.node as ReadableNode).dataController! ||
                            readableNode.dataController;
                        updateTreeRef(readableNode, name);
                        return;
                    }
                    if (data && data.length) {
                        const nodeData = data.find((d) => d.node.id === name);
                        if (nodeData && nodeData.pasteLocations && !copy) {
                            readableNode.dataController._pasteLocations =
                                nodeData.pasteLocations.map((p: any) => {
                                    return {
                                        ...p,
                                        location: LocationPlus.deserialize(
                                            p.location
                                        ),
                                    };
                                });
                        }
                    }
                } else {
                    name = `${name}:${uuidv4()}`; // idk where this code initially went lol
                }

                readableNode.setId(name);
                const firestoreCollectionPath = context._firestoreCollectionPath
                    .length
                    ? context._firestoreCollectionPath
                    : context.container.firestoreController!.getFileCollectionPath(
                          context.relativeFilePath
                      );

                if (!context._firestoreCollectionPath.length) {
                    context._firestoreCollectionPath = firestoreCollectionPath;
                }
                readableNode.dataController.firestoreControllerInterface =
                    map?.get(readableNode.id);
                if (newNode && context.container.firestoreController) {
                    readableNode.dataController._firestoreControllerInterface =
                        context.container.firestoreController.createNodeMetadata(
                            name,
                            firestoreCollectionPath
                        );
                }
                readableNode.registerListeners();
                const treeRef = currTreeInstance[
                    currTreeInstance.length - 1
                ].insert(
                    readableNode, // .readableNode,
                    { name }
                );
                if (name === 'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}') {
                    console.log(
                        'TREE REF',
                        treeRef,
                        'currTreeInstance',
                        currTreeInstance,
                        'map',
                        crazyIdeaMap,
                        'name',
                        name,
                        'readableNode',
                        readableNode,
                        'tree',
                        tree
                    );
                }
                readableNode.dataController.setTree(treeRef);
                currTreeInstance.push(treeRef);
                crazyIdeaMap.set(name, readableNode);
                debug = false;
            }
        }

        const updateTreeRef = (readableNode: ReadableNode, name: string) => {
            const treeRef = currTreeInstance[
                currTreeInstance.length - 1
            ].insert(
                readableNode, // .readableNode,
                { name }
            );
            if (name === 'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}') {
                console.log(
                    'TREE REF',
                    treeRef,
                    'currTreeInstance',
                    currTreeInstance,
                    'map',
                    crazyIdeaMap,
                    'name',
                    name,
                    'readableNode',
                    readableNode,
                    'tree',
                    tree
                );
            }
            readableNode.dataController!.setTree(treeRef);
            currTreeInstance.push(treeRef);
            crazyIdeaMap.set(name, readableNode);
            debug = false;
        };

        // Leave function will be executed after all children have been interacted with
        function leave(node: ts.Node) {
            const topNode = nodes.pop();
            if (topNode && ts.isBlock(topNode)) {
                const node = currTreeInstance.pop();
                if (node?.name === 'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}') {
                    console.log(
                        'POPPPPPPINGGGGGG',
                        node,
                        'map',
                        crazyIdeaMap,
                        'top',
                        topNode
                    );
                }
                const nodeToUpdate = crazyIdeaMap.get(node?.name || '');
                if (nodeToUpdate && node) {
                    nodeToUpdate.dataController!.setTree(node);
                    tree.swapNodes(node.root!.data, nodeToUpdate);
                    if (
                        node?.name ===
                        'If:8ae6e843-2a0f-462e-ba36-1ac534bb76d8}'
                    ) {
                        console.log(
                            'POST SET!!!!!!!!!!',
                            node,
                            'map',
                            crazyIdeaMap,
                            'top',
                            nodeToUpdate,
                            'tree',
                            tree
                        );
                    }
                    // context._relativeFilePath === 'source/utils/utils.ts' &&
                    //     console.log('popping', nodeToUpdate);
                    // can either have each node update itself and parents
                    // then notify document that _nodesInFile has changed at whatever
                    // level it is at
                } else {
                    console.log(
                        'WHEN DOES THIS HAPPEN',
                        node?.name,
                        crazyIdeaMap
                    );
                }
            }
        }
        sourceFile && tstraverse.traverse(sourceFile, { enter, leave });
        // do something like this to get the removed and commented-out nodes
        // const removedNodes = await Promise.all(
        //     knownNodes
        //         .filter((n) => !seenNodes.has(n.id))
        //         .map(async (n) => {
        //             return await context.container
        //                 .firestoreController!.createNodeMetadata(
        //                     n.id,
        //                     this._firestoreCollectionPath
        //                 )
        //                 .readPastVersions();
        //         })
        // );
        // console.log('removed???', removedNodes);
        return tree;
    }

    findNode(nodeId: string) {
        const arr = this._nodesInFile?.toArray() || [];
        console.log('arr', arr);
        return arr.find((n) => n.id === nodeId);
    }

    match(
        otherTreeInstance: SimplifiedTree<ReadableNode>,
        oldTree: SimplifiedTree<ReadableNode>,
        readableNode: ReadableNode,
        name: string,
        debug: boolean
    ) {
        const matchInfo = otherTreeInstance.getNodeOfBestMatch(
            readableNode // .readableNode
        );
        debug && console.log('wtf', readableNode, matchInfo, otherTreeInstance);

        if (matchInfo.status === SummaryStatus.SAME && matchInfo.bestMatch) {
            return {
                name: matchInfo.bestMatch.id,
                otherTreeInstance: matchInfo.subtree,
                node: matchInfo.bestMatch,
            };
        } else if (matchInfo.status === SummaryStatus.MODIFIED) {
            return {
                name: matchInfo.modifiedNodes?.id || name,
                otherTreeInstance: matchInfo.subtree,
                node: matchInfo.bestMatch,
            };
        } else {
            const matchInfo = oldTree.getNodeOfBestMatch(
                readableNode // .readableNode
            );
            debug &&
                console.log(
                    'wtf bigger search',
                    readableNode,
                    matchInfo,
                    oldTree
                );
            if (
                matchInfo.status === SummaryStatus.SAME &&
                matchInfo.bestMatch
            ) {
                return {
                    name: matchInfo.bestMatch.id,
                    otherTreeInstance: matchInfo.subtree,
                    node: matchInfo.bestMatch,
                };
            } else if (
                matchInfo.status === SummaryStatus.MODIFIED // may want to do something smarter with this
            ) {
                return {
                    name: matchInfo.modifiedNodes?.id || name,
                    otherTreeInstance: matchInfo.subtree,
                    node: matchInfo.bestMatch,
                };
            } else {
                // console.log('NEWBIE!!!!!!!!!!!!!', name, oldTree, readableNode);
                return {
                    name: `${name}:${uuidv4()}`,
                    otherTreeInstance: oldTree,
                    new: true,
                };
            }
        }
    }
}

export default DocumentWatcher;
