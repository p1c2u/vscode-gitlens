'use strict';
import { Iterables } from '../system';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { BranchHistoryNode } from './branchHistoryNode';
import { Explorer, ExplorerNode, ResourceType } from './explorerNode';
import { GitUri, Repository } from '../gitService';

export class BranchesNode extends ExplorerNode {

        constructor(
            uri: GitUri,
            private readonly repo: Repository,
            private readonly explorer: Explorer
        ) {
            super(uri);
        }

        async getChildren(): Promise<ExplorerNode[]> {
            const branches = await this.repo.getBranches();
            if (branches === undefined) return [];

            branches.sort((a, b) => (a.current ? -1 : 1) - (b.current ? -1 : 1) || a.name.localeCompare(b.name));
            return [...Iterables.filterMap(branches, b => b.remote ? undefined : new BranchHistoryNode(b, this.uri, this.explorer))];
        }

        async getTreeItem(): Promise<TreeItem> {
            const item = new TreeItem(`Branches`, TreeItemCollapsibleState.Expanded);

            const remotes = await this.repo.getRemotes();
            item.contextValue = (remotes !== undefined && remotes.length > 0)
                ? ResourceType.BranchesWithRemotes
                : ResourceType.Branches;

            item.iconPath = {
                dark: this.explorer.context.asAbsolutePath('images/dark/icon-branch.svg'),
                light: this.explorer.context.asAbsolutePath('images/light/icon-branch.svg')
            };

            return item;
        }
    }
