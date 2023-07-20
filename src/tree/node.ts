import * as ts from 'typescript';
import LocationPlus, {
    ChangeEvent,
    SerializedLocationPlus,
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
import { debounce } from '../lib';

interface SerializedReadableNode {
    humanReadableKind: string;
    location: SerializedLocationPlus;
    id: string;
}

export enum NodeState {
    UNCHANGED = 'UNCHANGED',
    MODIFIED_RANGE = 'MODIFIED_RANGE',
    MODIFIED_CONTENT = 'MODIFIED_CONTENT',
    MODIFIED_RANGE_AND_CONTENT = 'MODIFIED_RANGE_AND_CONTENT',
    DELETED = 'DELETED',
    ADDED = 'ADDED',
}

class ReadableNode extends AbstractTreeReadableNode<ReadableNode> {
    readonly node: ts.Node | undefined;
    readonly humanReadableKind: string;
    readonly _container: Container | undefined;
    _dataController: DataController | undefined;
    location: LocationPlus;
    id: string;

    visited?: boolean;
    state?: NodeState;
    constructor(
        // private readonly container: Container,
        humanReadableKind: string,
        location: LocationPlus,
        container?: Container,
        node?: ts.Node,
        id?: string
    ) {
        super();
        this.node = node;
        this.humanReadableKind = humanReadableKind;
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
                this.id.includes('activate') &&
                    console.log(
                        'ACTIVATE THIS!!!!!!!',
                        this,
                        'event',
                        changeEvent
                    );
                // if (this.state === NodeState.MODIFIED_RANGE_AND_CONTENT) {
                //     console.log('this!!!!!!!!!!!!!', this);
                // }
                // debounce(() => {
                //     const newContent = this.location.content;
                //     const numConsoleLogs = newContent.split('console.');
                // });
            }
        );
        const selectedDisposable = this.location.onSelected.event(
            async (location: LocationPlus) => {
                // placeholder
            }
        );

        return () => {
            deleteDisposable.dispose();
            changedDisposable.dispose();
            selectedDisposable.dispose();
        };
    }

    compare(node: ReadableNode): CompareSummary<ReadableNode> {
        if (this.visited) {
            return {
                status: SummaryStatus.UNKNOWN,
            };
        }
        const res = {
            distanceDelta: this.location.compare(node.location),
            bagOfWordsScore: this.getBagOfWordsScore(node),
            isSameType: this.humanReadableKind === node.humanReadableKind,
        };

        // paper said .9 or above pretty much meant it is the same
        if (res.bagOfWordsScore >= 0.9 && res.isSameType) {
            this.visited = true;
            return {
                status: SummaryStatus.SAME,
                bestMatch: this,
            };
        } else if (res.bagOfWordsScore >= 0.5 && res.isSameType) {
            this.visited = true; // ?
            return {
                status: SummaryStatus.MODIFIED,
                modifiedNodes: this,
            };
        } else {
            return {
                status: SummaryStatus.UNKNOWN,
            };
        }
    }

    // similar approach to this paper
    // https://dl.acm.org/doi/abs/10.1145/2858036.2858442?casa_token=m_c4cxv1br8AAAAA:JSXZo8OMn9CV3YaYBawsRvZhZFhOsLJurX5qXfckEL_cO1dgBMS1hhbudI9P7JpM0F015wEzrJMf
    private getBagOfWordsScore(node: ReadableNode) {
        const contentWords = stripNonAlphanumeric(this.location.content);
        const thisWordLengthProportion =
            contentWords.length > 0 ? 1 / contentWords.length : 0;

        const otherContentWords = stripNonAlphanumeric(node.location.content);
        const otherWordLengthProportion =
            otherContentWords.length > 0 ? 1 / otherContentWords.length : 0;
        return (
            0.5 *
            intersectionBetweenStrings(contentWords, otherContentWords) *
            (thisWordLengthProportion + otherWordLengthProportion)
        );
    }
}

export default ReadableNode;
