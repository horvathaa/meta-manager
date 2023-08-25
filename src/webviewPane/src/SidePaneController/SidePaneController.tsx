import { createRoot } from 'react-dom/client';
import {
    AdditionalMetadata,
    CopyBuffer,
    WEB_INFO_SOURCE,
} from '../../../view/src/types/types';
import ChatGptHistory from '../ChatGptHistory/ChatGptHistory';
import * as React from 'react';

interface InitData {
    type: WEB_INFO_SOURCE;
    node: any;
    copyBuffer: CopyBuffer;
}

class SidePaneController {
    private readonly _ref;
    // _graphController: GraphController;
    // _gitInformationController: GitInformationController;
    // _metaInformationController: MetaInformationController;
    // _node: Payload | undefined;
    constructor(initData?: InitData) {
        console.log('constructing');
        const container =
            document.getElementById('root') || document.createElement('div');
        console.log('container', container);
        this._ref = createRoot(container);
        console.log('ref', this._ref, initData);
        // this._graphController = new GraphController(this);
        // this._gitInformationController = new GitInformationController(this);
        // this._metaInformationController = new MetaInformationController(this);
        // console.log('graph', this._graphController);
        this.initListeners();
        if (initData) {
            this._ref.render(
                <ChatGptHistory copyBufferProps={initData.copyBuffer} />
            );
        }
        // this.constructGraph();
    }

    initListeners() {
        console.log('hewwo!!!!!!!!!!!!!!');
        window.addEventListener('message', (e) =>
            this.handleIncomingMessage(e, this)
        );
        return () =>
            window.removeEventListener('message', (e) =>
                this.handleIncomingMessage(e, this)
            );
    }

    handleIncomingMessage(e: MessageEvent<any>, context: SidePaneController) {
        const message = e.data; // The JSON data our extension sent
        console.log('hewwo?????', message);
        switch (message.command) {
            case 'updateTimeline': {
                const { data } = message;
                const { id, metadata } = data;
                console.log('stuff', data, id, metadata);
                // this._node = metadata as Payload;
                // context.updateTimeline(id, metadata);
                break;
            }
            default: {
                console.log('default');
            }
        }
    }
}
// new TimelineController();
export default SidePaneController;
