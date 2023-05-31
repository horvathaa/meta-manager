import { LegalDataSource } from '../constants/types';
import { DataController } from './DataController';

class CodeAnchor {
    constructor(
        dataStore: LegalDataSource,
        private readonly dataController: DataController
    ) {}
}

export default CodeAnchor;
