import { Disposable } from 'vscode';
import { LegalDataType } from '../DataController';
import { DefaultLogFields, ListLogLine } from 'simple-git';
import { TS } from 'timelines-chart';
import { DocumentData } from 'firebase/firestore';

interface TimelineData {
    timeRange: [TS, TS];
    val: string;
    labelVal?: string;
}

export enum DataSourceType {
    GIT = 'git',
    FIRESTORE = 'firestore',
}

function isLogResult(
    data: LegalDataType
): data is DefaultLogFields & ListLogLine {
    return (data as DefaultLogFields & ListLogLine).hash !== undefined;
}

class TimelineEvent extends Disposable {
    _formattedData: TimelineData;
    _dataSourceType: DataSourceType;
    constructor(private readonly originalData: LegalDataType) {
        super(() => this.dispose());
        this._dataSourceType = this.getDataSourceType();
        this._formattedData = this.formatData();
    }

    getDataSourceType() {
        if (isLogResult(this.originalData)) {
            return DataSourceType.GIT;
        }
        return DataSourceType.FIRESTORE; // will need more of these probably later
    }

    formatData(): TimelineData {
        switch (this._dataSourceType) {
            case DataSourceType.GIT: {
                const data = this.originalData as DefaultLogFields &
                    ListLogLine;
                return {
                    timeRange: [
                        new Date(data.date).getTime(),
                        new Date(data.date).getTime() + 10000000,
                    ],
                    val: DataSourceType.GIT,
                    labelVal: `${data.hash.slice(0, 6) || ''} ${
                        data.message
                    } by ${data.author_name} at ${data.date}`,
                };
            }
            case DataSourceType.FIRESTORE: {
                const data = this.originalData as DocumentData;
                const endTimestamp = data.deletedTimestamp
                    ? data.deletedTimestamp
                    : data.editedTimestamp || data.createdTimestamp;
                return {
                    timeRange: [
                        new Date(data.createdTimestamp).getTime(),
                        new Date(endTimestamp).getTime(),
                    ],
                    val: DataSourceType.FIRESTORE,
                    labelVal: `${data.createdTimestamp} - ${endTimestamp}`,
                };
            }
            default: {
                return {
                    timeRange: [0, 1],
                    val: 'val',
                };
            }
        }
    }

    getTimeRange() {
        return [0, 1];
    }

    getVal() {
        return 'val';
    }
}

export default TimelineEvent;
