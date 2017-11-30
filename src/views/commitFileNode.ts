'use strict';
import { Command, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { Commands, DiffWithPreviousCommandArgs } from '../commands';
import { Explorer, ExplorerNode, ResourceType } from './explorerNode';
import { CommitFormatter, getGitStatusIcon, GitBranch, GitCommit, GitCommitType, GitUri, ICommitFormatOptions, IGitStatusFile, IStatusFormatOptions, StatusFileFormatter } from '../gitService';
import * as path from 'path';

export enum CommitFileNodeDisplayAs {
    CommitLabel = 1 << 0,
    CommitIcon = 1 << 1,
    FileLabel = 1 << 2,
    StatusIcon = 1 << 3,

    Commit = CommitLabel | CommitIcon,
    File = FileLabel | StatusIcon
}

export class CommitFileNode extends ExplorerNode {

    readonly priority: boolean = false;
    readonly repoPath: string;

    constructor(
        public readonly status: IGitStatusFile,
        public commit: GitCommit,
        protected readonly explorer: Explorer,
        private displayAs: CommitFileNodeDisplayAs = CommitFileNodeDisplayAs.Commit,
        public readonly branch?: GitBranch
    ) {
        super(new GitUri(Uri.file(path.resolve(commit.repoPath, status.fileName)), { repoPath: commit.repoPath, fileName: status.fileName, sha: commit.sha }));
        this.repoPath = commit.repoPath;
    }

    async getChildren(): Promise<ExplorerNode[]> {
        return [];
    }

    async getTreeItem(): Promise<TreeItem> {
        if (this.commit.type !== GitCommitType.File) {
            const log = await this.explorer.git.getLogForFile(this.repoPath, this.status.fileName, this.commit.sha, { maxCount: 2 });
            if (log !== undefined) {
                this.commit = log.commits.get(this.commit.sha) || this.commit;
            }
        }

        const item = new TreeItem(this.label, TreeItemCollapsibleState.None);
        item.contextValue = this.resourceType;

        const icon = (this.displayAs & CommitFileNodeDisplayAs.CommitIcon)
            ? 'icon-commit.svg'
            : getGitStatusIcon(this.status.status);

        item.iconPath = {
            dark: this.explorer.context.asAbsolutePath(path.join('images', 'dark', icon)),
            light: this.explorer.context.asAbsolutePath(path.join('images', 'light', icon))
        };

        item.command = this.getCommand();

        // Only cache the label for a single refresh
        this._label = undefined;

        return item;
    }

    private _folderName: string | undefined;
    get folderName() {
        if (this._folderName === undefined) {
            this._folderName = path.dirname(this.uri.getRelativePath());
        }
        return this._folderName;
    }

    private _label: string | undefined;
    get label() {
        if (this._label === undefined) {
            this._label = (this.displayAs & CommitFileNodeDisplayAs.CommitLabel)
                ? CommitFormatter.fromTemplate(this.getCommitTemplate(), this.commit, {
                    truncateMessageAtNewLine: true,
                    dataFormat: this.explorer.git.config.defaultDateFormat
                } as ICommitFormatOptions)
                : StatusFileFormatter.fromTemplate(this.getCommitFileTemplate(),
                    this.status,
                    { relativePath: this.relativePath } as IStatusFormatOptions);
        }
        return this._label;
    }

    private _relativePath: string | undefined;
    get relativePath(): string | undefined {
        return this._relativePath;
    }
    set relativePath(value: string | undefined) {
        this._relativePath = value;
        this._label = undefined;
    }

    protected get resourceType(): ResourceType {
        return ResourceType.CommitFile;
    }

    protected getCommitTemplate() {
        return this.explorer.config.commitFormat;
    }

    protected getCommitFileTemplate() {
        return this.explorer.config.commitFileFormat;
    }

    getCommand(): Command | undefined {
        return {
            title: 'Compare File with Previous Revision',
            command: Commands.DiffWithPrevious,
            arguments: [
                GitUri.fromFileStatus(this.status, this.commit.repoPath),
                {
                    commit: this.commit,
                    line: 0,
                    showOptions: {
                        preserveFocus: true,
                        preview: true
                    }
                } as DiffWithPreviousCommandArgs
            ]
        };
    }
}