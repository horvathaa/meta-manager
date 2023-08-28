import * as ts from 'typescript';
import LocationPlus, {
    ChangeEvent,
    TypeOfChange,
} from '../document/locationApi/location';
import { TextDocument } from 'vscode';
import { nodeToRange } from '../document/lib';
import {
    AbstractTreeReadableNode,
    CompareSummary,
    SummaryStatus,
} from './tree';
import {
    intersectionBetweenStrings,
    stripNonAlphanumeric,
} from './helpers/lib';
import { Container } from '../container';
import { DataController } from '../data/DataController';
import { debounce } from '../utils/lib';
import { SerializedReadableNode } from '../constants/types';

export function nodeContentChange(nodeState: NodeState) {
    return (
        nodeState === NodeState.MODIFIED_CONTENT ||
        nodeState === NodeState.MODIFIED_RANGE_AND_CONTENT
    );
}

export function TypeOfChangeToNodeState(typeOfChange: TypeOfChange) {
    switch (typeOfChange) {
        case TypeOfChange.CONTENT_ONLY:
            return NodeState.MODIFIED_CONTENT;
        case TypeOfChange.RANGE_ONLY:
            return NodeState.MODIFIED_RANGE;
        case TypeOfChange.RANGE_AND_CONTENT:
            return NodeState.MODIFIED_RANGE_AND_CONTENT;
        default:
            return NodeState.UNCHANGED;
    }
}

export enum NodeState {
    UNCHANGED = 'UNCHANGED',
    MODIFIED_RANGE = 'MODIFIED_RANGE',
    MODIFIED_CONTENT = 'MODIFIED_CONTENT',
    MODIFIED_RANGE_AND_CONTENT = 'MODIFIED_RANGE_AND_CONTENT',
    DELETED = 'DELETED',
    ADDED = 'ADDED',
}

const LANGUAGE_ID_MAP: { [key: string]: any } = {
    ts: 'typescript',
    js: 'javascript',
    tsx: 'typescriptreact',
    jsx: 'javascriptreact',
};

class ReadableNode extends AbstractTreeReadableNode<ReadableNode> {
    readonly node: ts.Node | undefined;
    readonly humanReadableKind: string;
    readonly _container: Container | undefined;
    _dataController: DataController | undefined;
    location: LocationPlus;
    id: string;
    languageId: string;
    visited?: boolean;
    state?: NodeState;
    constructor(
        // private readonly container: Container,
        humanReadableKind: string,
        location: LocationPlus,
        container?: Container,
        node?: ts.Node,
        id?: string,
        firestore?: any
    ) {
        super();
        this.node = node;
        this.humanReadableKind = humanReadableKind;
        const fileExtension = location.uri.fsPath.split('.').pop();
        this.languageId =
            fileExtension && LANGUAGE_ID_MAP[fileExtension]
                ? LANGUAGE_ID_MAP[fileExtension]
                : 'typescript';
        this.location = location;
        this.id = id || '';
        this.visited = false;
    }

    static create(
        node: ts.Node,
        docOrLocation: TextDocument | LocationPlus,
        container?: Container,
        id?: string
    ) {
        const location =
            docOrLocation instanceof LocationPlus
                ? docOrLocation
                : new LocationPlus(
                      docOrLocation.uri,
                      nodeToRange(node, docOrLocation.getText()),
                      { doc: docOrLocation, id }
                  );
        return new ReadableNode(
            ts.SyntaxKind[node.parent.kind],
            location,
            container,
            node,
            id
        );
    }

    setId(id: string) {
        this.id = id;
    }

    get dataController() {
        return this._dataController;
    }

    set dataController(dataController: DataController | undefined) {
        this._dataController = dataController;
    }

    copy() {
        return new ReadableNode(
            this.humanReadableKind,
            this.location,
            this._container,
            this.node,
            this.id
        );
    }

    serialize() {
        return {
            humanReadableKind: this.humanReadableKind,
            location: this.location.serialize(),
            id: this.id,
        };
    }

    deserialize(serialized: SerializedReadableNode) {
        const location = LocationPlus.deserialize(serialized.location);
        return new ReadableNode(
            // serialized.node,
            serialized.humanReadableKind,
            location,
            undefined, // double uggo
            undefined, // ugly
            serialized.id
        );
    }

    getNodeState(typeOfChange: TypeOfChange) {
        switch (typeOfChange) {
            case TypeOfChange.CONTENT_ONLY:
                return NodeState.MODIFIED_CONTENT;
            case TypeOfChange.RANGE_ONLY:
                return NodeState.MODIFIED_RANGE;
            case TypeOfChange.RANGE_AND_CONTENT:
                return NodeState.MODIFIED_RANGE_AND_CONTENT;
            default:
                return NodeState.UNCHANGED;
        }
    }

    registerListeners() {
        const deleteDisposable = this.location.onDelete.event(
            (location: LocationPlus) => {
                this.state = NodeState.DELETED; // should let tree know to remove this node
                // mark as event for code
                changedDisposable.dispose();
                selectedDisposable.dispose();
            }
        );
        const changedDisposable = this.location.onChanged.event(
            (changeEvent: ChangeEvent) => {
                this.state = this.getNodeState(changeEvent.typeOfChange);
            }
        );
        const selectedDisposable = this.location.onSelected.event(
            async (location) => {
                // placeholder
                // console.log('selected', location, 'this', this);
            }
        );

        return () => {
            deleteDisposable.dispose();
            changedDisposable.dispose();
            selectedDisposable.dispose();
        };
    }

    compare(node: ReadableNode): CompareSummary<ReadableNode> {
        // may want to bring this back too?
        // idk
        // if (this.visited) {
        //     return {
        //         status: SummaryStatus.UNKNOWN,
        //     };
        // }
        const res = {
            distanceDelta: this.location.compare(node.location),
            bagOfWordsScore: calculateBagOfWordsScore(
                this.location.content,
                node.location.content
            ),
            isSameType: this.humanReadableKind === node.humanReadableKind,
            isSameName: this.location.id === node.location.id,
        };

        // paper said .9 or above pretty much meant it is the same
        if (res.bagOfWordsScore >= 0.9 && res.isSameType) {
            // little skeptical about this but we shall see
            // if (res.bagOfWordsScore >= 0.9) {
            this.visited = true;
            return {
                status: SummaryStatus.SAME,
                bestMatch: this,
                additionalData: res,
            };
        } else if (res.bagOfWordsScore >= 0.5 && res.isSameType) {
            this.visited = true; // ?
            return {
                status: SummaryStatus.MODIFIED,
                modifiedNodes: this,
                additionalData: res,
            };
        } else {
            return {
                status: SummaryStatus.UNKNOWN,
                additionalData: res,
            };
        }
    }
}

// similar approach to this paper
// https://dl.acm.org/doi/abs/10.1145/2858036.2858442?casa_token=m_c4cxv1br8AAAAA:JSXZo8OMn9CV3YaYBawsRvZhZFhOsLJurX5qXfckEL_cO1dgBMS1hhbudI9P7JpM0F015wEzrJMf
function calculateBagOfWordsScore(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const uniqueWords = [...new Set([...words1, ...words2])];
    let commonWordsCount = 0;
    uniqueWords.forEach((word) => {
        if (words1.includes(word) && words2.includes(word)) {
            commonWordsCount++;
        }
    });

    const score = commonWordsCount / uniqueWords.length;
    return score;
}

export default ReadableNode;
