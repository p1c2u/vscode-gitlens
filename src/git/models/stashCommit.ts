'use strict';
import { GitCommitType } from './commit';
import { GitLogCommit } from './logCommit';
import { IGitStatusFile } from './status';

export class GitStashCommit extends GitLogCommit {

    constructor(
        public readonly stashName: string,
        repoPath: string,
        sha: string,
        date: Date,
        message: string,
        fileName: string,
        fileStatuses: IGitStatusFile[]
    ) {
        super(
            GitCommitType.Stash,
            repoPath,
            sha,
            'You',
            date,
            message,
            fileName,
            fileStatuses,
            undefined,
            undefined,
            `${sha}^`,
            undefined
        );
    }

    get shortSha() {
        return this.stashName;
    }
}