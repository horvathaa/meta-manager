import CodeNode from './CodeNode';
import { context } from './GraphController';
import GraphController from './GraphController';
import * as React from 'react';
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
    return (
        <div>
            <div>
                <p>Current index: {graphController._focusedIndex}</p>
                <p>Current search term: {graphController._searchTerm}</p>
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
