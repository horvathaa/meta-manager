import * as ts from 'typescript';
import LocationPlus, {
    SerializedLocationPlus,
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

interface SerializedReadableNode {
    humanReadableKind: string;
    location: SerializedLocationPlus;
    id: string;
    // parentId: string; // tree handles this
}

class ReadableNode extends AbstractTreeReadableNode<ReadableNode> {
    readonly node: ts.Node | undefined;
    readonly humanReadableKind: string;
    location: LocationPlus;
    id: string;
    constructor(
        humanReadableKind: string,
        location: LocationPlus,
        node?: ts.Node,
        id?: string
    ) {
        super();
        this.node = node;
        this.humanReadableKind = humanReadableKind;
        this.location = location;
        this.id = id || '';
    }

    static create(
        node: ts.Node,
        docOrLocation: TextDocument | LocationPlus,
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
        return new ReadableNode(ts.SyntaxKind[node.kind], location, node, id);
    }

    setId(id: string) {
        this.id = id;
    }

    copy() {
        return new ReadableNode(
            this.humanReadableKind,
            this.location,
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
            undefined, // ugly
            serialized.id
        );
    }

    compare(node: ReadableNode): CompareSummary<ReadableNode> {
        const res = {
            distanceDelta: this.location.compare(node.location),
            bagOfWordsScore: this.getBagOfWordsScore(node),
        };

        if (res.bagOfWordsScore >= 0.9) {
            return {
                status: SummaryStatus.SAME,
            };
        } else if (
            res.bagOfWordsScore >= 0.5
            // ||
            // 10 > Math.abs(res.distanceDelta.startDelta.lineDelta)
        ) {
            return {
                status: SummaryStatus.MODIFIED,
                modifiedNodes: this,
            };
        } else {
            console.log('res', res, 'this', this, 'node', node);
            return {
                status: SummaryStatus.UNKNOWN,
            };
        }
    }

    // similar approach to this paper
    // https://dl.acm.org/doi/abs/10.1145/2858036.2858442?casa_token=m_c4cxv1br8AAAAA:JSXZo8OMn9CV3YaYBawsRvZhZFhOsLJurX5qXfckEL_cO1dgBMS1hhbudI9P7JpM0F015wEzrJMf
    private getBagOfWordsScore(node: ReadableNode) {
        const contentWords = stripNonAlphanumeric(this.location.content);
        const otherContentWords = stripNonAlphanumeric(node.location.content);
        return (
            0.5 *
            intersectionBetweenStrings(contentWords, otherContentWords) *
            (1 / contentWords.length + 1 / otherContentWords.length)
        );
    }
}

export default ReadableNode;
