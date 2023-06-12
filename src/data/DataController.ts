import { Uri, Range } from 'vscode';
import { Container } from '../container';
import { AbstractTreeReadableNode, CompareSummary } from '../tree/tree';
import ReadableNode from '../tree/node';
import LocationPlus from '../document/locationApi/location';
import { ListLogLine, DefaultLogFields } from 'simple-git';
import { DocumentData } from 'firebase/firestore';
import TimelineEvent from './timeline/TimelineEvent';

export type LegalDataType = (DefaultLogFields & ListLogLine) | DocumentData; // not sure this is the right place for this but whatever

export class DataController extends AbstractTreeReadableNode<ReadableNode> {
    _gitData: TimelineEvent[] | undefined;
    _firestoreData: TimelineEvent[] | undefined;
    _readableNode: ReadableNode;

    // this can be accessed anywhere in the class with the "this" keyword -- TIL
    constructor(
        readableNode: ReadableNode,
        private readonly container: Container
    ) {
        super();
        this._readableNode = readableNode;
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
        this._readableNode.location.onSelected.event(async () => {
            const res = await this.getGitData();
            if (res) {
                this._gitData = res.all.map((r) => new TimelineEvent(r));
                // this.container.timelineController?.updateTimeline(
                //     this.readableNode.id,
                //     this._gitData
                // );
                this.container.webviewController?.postMessage({
                    command: 'updateTimeline',
                    data: {
                        id: this.readableNode.id,
                        timelineData: this._gitData,
                    },
                });
                console.log('this', this);
            }

            // this._firestoreData = this.getFirestoreData();
        });
    }

    getGitData() {
        return this.container.gitController?.gitLog(
            this._readableNode.location
        );
    }
}
