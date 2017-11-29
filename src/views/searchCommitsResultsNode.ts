'use strict';
import { Iterables } from '../system';
import { TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { CommitNode } from './commitNode';
import { Explorer, ExplorerNode, ResourceType, ShowAllNode } from './explorerNode';
import { GitLog, GitUri } from '../gitService';

export class SearchCommitsResultsNode extends ExplorerNode {

    readonly supportsPaging: boolean = true;

    private _cache: { label: string, log: GitLog | undefined } | undefined;

    constructor(
        private readonly search: string,
        readonly repoPath: string,
        private readonly logFn: (maxCount: number | undefined) => Promise<GitLog | undefined>,
        private readonly explorer: Explorer
    ) {
        super(new GitUri(Uri.file(repoPath), { repoPath: repoPath, fileName: repoPath }));
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const log = await this.getLog();
        if (log === undefined) return [];

        const children: (CommitNode | ShowAllNode)[] = [...Iterables.map(log.commits.values(), c => new CommitNode(c, this.explorer))];
        if (log.truncated) {
            children.push(new ShowAllNode('Show All Results', this, this.explorer));
        }
        return children;
    }

    async getTreeItem(): Promise<TreeItem> {
        const item = new TreeItem(await this.getLabel(), TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.Results;
        return item;
    }

    refresh() {
        this._cache = undefined;
    }

    private async ensureCache() {
        if (this._cache === undefined) {
            const log = await this.logFn(this.maxCount);
            const count = log !== undefined ? log.count : 0;
            const truncated = log !== undefined ? log.truncated : false;

            this._cache = {
                label: `${count === undefined ? 'Results' : `${count}${truncated ? '+' : ''} results`} for ${this.search}`,
                log: log
            };
        }

        return this._cache;
    }

    private async getLabel() {
        const cache = await this.ensureCache();
        return cache.label;
    }

    private async getLog() {
        const cache = await this.ensureCache();
        return cache.log;
    }
}