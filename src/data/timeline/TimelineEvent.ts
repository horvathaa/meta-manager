/* eslint-disable @typescript-eslint/naming-convention */
import { Disposable } from 'vscode';
import { LegalDataType } from '../DataController';
import { DefaultLogFields, ListLogLine } from 'simple-git';

interface TimelineData {
    timeRange: number[];
    val: string;
}

enum DataSourceType {
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

    formatData() {
        switch (this._dataSourceType) {
            case DataSourceType.GIT: {
                const data = this.originalData as DefaultLogFields &
                    ListLogLine;
                return {
                    timeRange: [
                        new Date(data.date).getTime(),
                        new Date(data.date).getTime(),
                    ],
                    val: `${data.hash || ''} ${data.message} by ${
                        data.author_name
                    } at ${data.date}`,
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
