import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import CodeNode from './CodeNode';
import { context } from './GraphController';
import GraphController from './GraphController';
import * as React from 'react';
import styles from '../styles/timeline.module.css';
// import { context }

interface Props {
    parentProp: GraphController;
}

const parentFilter: { [k: string]: { [v: string]: boolean } } = {};

const InfoWidget: React.FC<Props> = ({ parentProp }) => {
    const parent = React.useContext(context);
    const [mainFilter, setMainFilter] = React.useState(parentFilter);
    const [knownKeys, setKnownKeys] = React.useState<string[]>([]);
    // const graphController = parentProp;
    const { graphController } = parent;
    if (!graphController) {
        return null;
    }
    React.useEffect(() => {
        // console.log('useEffect! info widget');
        // }, [parentProp]);
    }, [parent]);

    const { _searchResults, _searchTerm, _filtered, _keyMap, _filterRange } =
        graphController;
    return (
        <div>
            <div style={{ margin: '1rem' }}>
                <h3>Version {graphController._focusedIndex}</h3>
                {_filtered ? (
                    <div className={styles['p2']}>
                        <div>
                            Viewing version(s) {_filterRange[0]} to{' '}
                            {_filterRange[1]}
                        </div>
                        <VSCodeButton
                            onClick={() => graphController.clearRange()}
                        >
                            Reset version range?
                        </VSCodeButton>
                    </div>
                ) : null}
                {_searchTerm.length || _searchResults ? (
                    <div className={styles['p2']}>
                        <div>
                            Searching for{' '}
                            <code>
                                {_searchTerm.length
                                    ? _searchTerm
                                    : _searchResults?.query}
                            </code>
                        </div>
                        <VSCodeButton
                            onClick={() => graphController.clearSearch()}
                        >
                            Clear search?
                        </VSCodeButton>
                    </div>
                ) : null}
                <div>
                    <VSCodeButton
                        onClick={() => graphController.resetScrubber()}
                    >
                        Reset filter?
                    </VSCodeButton>
                </div>
            </div>
            {Object.keys(
                graphController._keyMap[graphController._currIndex]
            ).map((key) => {
                if (key === 'scale') {
                    return null;
                }
                if (!mainFilter[key]) {
                    mainFilter[key] = {};
                }
                const node = graphController._keyMap[
                    graphController._currIndex
                ][key][1].data.find((d: any) => d.currNode);
                if (!node) {
                    return null;
                }
                return (
                    <div>
                        {/* <h2>{key}</h2> */}
                        <CodeNode
                            key={key}
                            currNode={node}
                            versions={
                                graphController._keyMap[
                                    graphController._currIndex
                                ][key][1].data
                            }
                            context={graphController}
                            color={graphController._colorKey[key]}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default InfoWidget;
